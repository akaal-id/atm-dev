import "server-only";

import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import { getResourceById } from "@/lib/server/store";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { hasPermission } from "@/lib/permissions";
import type { CurrentUser, Project } from "@/lib/types";
import {
  type ContentInput,
  type ContentItem,
  defaultStrategyOptions,
  strategyOptionTypes,
  type Brand,
  type ProjectHubData,
  type ProjectKpi,
  type StrategyOption,
  type StrategyOptionType,
} from "@/lib/types/project-hub";
import type { AudiencePersona, Campaign } from "@/lib/types/social-hub";
import { makeId } from "@/lib/utils";

const enc = encodeURIComponent;

export type ProjectAccess = {
  user: CurrentUser;
  project: Project;
  companyId: string;
  /** Managers, the project owner and the PIC can edit hub data. */
  canEdit: boolean;
  /** Editors plus project members can work on the content matrix. */
  canContribute: boolean;
};

/** Resolve the project within the caller's active company, or null when missing / out of scope. */
export async function getProjectAccess(projectId: string): Promise<ProjectAccess | null> {
  const user = await getCurrentUser();
  if (!user || !projectId) return null;

  const project = (await getResourceById("Projects", projectId)) as Project | undefined;
  if (!project) return null;

  const companyId = project.company_id || (await getActiveCompanyContext(user.user_id)).company.id;
  const canEdit =
    hasPermission(user.role_id, "projects:manage") ||
    project.owner_user_id === user.user_id ||
    project.pic_user_id === user.user_id;

  const canContribute = canEdit || project.members.includes(user.user_id);

  return { user: user as CurrentUser, project, companyId, canEdit, canContribute };
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOption(row: StrategyOption): StrategyOption {
  return {
    ...row,
    target_share: row.target_share === null || row.target_share === undefined ? null : toNumber(row.target_share),
    sort_order: toNumber(row.sort_order),
  };
}

function normalizeKpi(row: ProjectKpi): ProjectKpi {
  return {
    ...row,
    target_value: toNumber(row.target_value),
    actual_value: toNumber(row.actual_value),
    sort_order: toNumber(row.sort_order),
  };
}

// ── Brands ────────────────────────────────────────────────────────────────

export async function listCompanyBrands(companyId: string) {
  return supabaseRest<Brand[]>(`/brands?company_id=eq.${enc(companyId)}&select=*&order=name.asc`);
}

export async function createBrand(companyId: string, input: { name: string; parent_brand_id?: string | null }) {
  const now = new Date().toISOString();
  const [brand] = await supabaseRest<Brand[]>("/brands", {
    method: "POST",
    body: JSON.stringify({
      brand_id: makeId("brd"),
      company_id: companyId,
      parent_brand_id: input.parent_brand_id || null,
      name: input.name,
      created_at: now,
      updated_at: now,
    }),
  });
  return brand;
}

export async function setProjectBrands(projectId: string, companyId: string, brandIds: string[]) {
  const allowed = new Set((await listCompanyBrands(companyId)).map((brand) => brand.brand_id));
  const ids = [...new Set(brandIds)].filter((id) => allowed.has(id));

  await supabaseRest<void>(`/project_brands?project_id=eq.${enc(projectId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  if (ids.length === 0) return [];

  await supabaseRest<void>("/project_brands", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(ids.map((brand_id) => ({ project_id: projectId, brand_id, company_id: companyId }))),
  });
  return ids;
}

// ── Strategy options ──────────────────────────────────────────────────────

export function isStrategyOptionType(value: unknown): value is StrategyOptionType {
  return strategyOptionTypes.includes(value as StrategyOptionType);
}

export async function listStrategyOptions(projectId: string) {
  const rows = await supabaseRest<StrategyOption[]>(
    `/project_strategy_options?project_id=eq.${enc(projectId)}&select=*&order=type.asc,sort_order.asc,created_at.asc`,
  );
  return rows.map(normalizeOption);
}

export async function createStrategyOption(
  projectId: string,
  companyId: string,
  input: Pick<StrategyOption, "type" | "label"> & Partial<Pick<StrategyOption, "description" | "target_share" | "sort_order">>,
) {
  const now = new Date().toISOString();
  const [row] = await supabaseRest<StrategyOption[]>("/project_strategy_options", {
    method: "POST",
    body: JSON.stringify({
      option_id: makeId("opt"),
      project_id: projectId,
      company_id: companyId,
      type: input.type,
      label: input.label,
      description: input.description ?? "",
      target_share: input.target_share ?? null,
      sort_order: input.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    }),
  });
  return normalizeOption(row);
}

export async function updateStrategyOption(
  projectId: string,
  optionId: string,
  patch: Partial<Pick<StrategyOption, "label" | "description" | "target_share" | "sort_order">>,
) {
  const rows = await supabaseRest<StrategyOption[]>(
    `/project_strategy_options?project_id=eq.${enc(projectId)}&option_id=eq.${enc(optionId)}`,
    { method: "PATCH", body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) },
  );
  return rows[0] ? normalizeOption(rows[0]) : null;
}

export async function deleteStrategyOption(projectId: string, optionId: string) {
  await supabaseRest<void>(`/project_strategy_options?project_id=eq.${enc(projectId)}&option_id=eq.${enc(optionId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

/** Insert the Akaal default funnel/pillar/channel set, skipping labels the project already has. */
export async function applyDefaultStrategy(projectId: string, companyId: string) {
  const existing = await listStrategyOptions(projectId);
  const taken = new Set(existing.map((option) => `${option.type}:${option.label.toLowerCase()}`));
  const now = new Date().toISOString();
  const rows = defaultStrategyOptions
    .map((option, index) => ({ ...option, sort_order: index }))
    .filter((option) => !taken.has(`${option.type}:${option.label.toLowerCase()}`))
    .map((option) => ({
      option_id: makeId("opt"),
      project_id: projectId,
      company_id: companyId,
      ...option,
      created_at: now,
      updated_at: now,
    }));

  if (rows.length > 0) {
    await supabaseRest<void>("/project_strategy_options", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
  }
  return rows.length;
}

// ── KPIs ──────────────────────────────────────────────────────────────────

export async function listProjectKpis(projectId: string) {
  const rows = await supabaseRest<ProjectKpi[]>(
    `/project_kpis?project_id=eq.${enc(projectId)}&select=*&order=sort_order.asc,created_at.asc`,
  );
  return rows.map(normalizeKpi);
}

type KpiInput = Partial<Pick<ProjectKpi, "name" | "unit" | "target_value" | "actual_value" | "channel" | "funnel" | "sort_order">>;

export async function createProjectKpi(projectId: string, companyId: string, input: KpiInput & { name: string }) {
  const now = new Date().toISOString();
  const [row] = await supabaseRest<ProjectKpi[]>("/project_kpis", {
    method: "POST",
    body: JSON.stringify({
      kpi_id: makeId("kpi"),
      project_id: projectId,
      company_id: companyId,
      unit: "",
      target_value: 0,
      actual_value: 0,
      channel: "",
      funnel: "",
      sort_order: 0,
      ...input,
      created_at: now,
      updated_at: now,
    }),
  });
  return normalizeKpi(row);
}

export async function updateProjectKpi(projectId: string, kpiId: string, patch: KpiInput) {
  const rows = await supabaseRest<ProjectKpi[]>(`/project_kpis?project_id=eq.${enc(projectId)}&kpi_id=eq.${enc(kpiId)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  return rows[0] ? normalizeKpi(rows[0]) : null;
}

export async function deleteProjectKpi(projectId: string, kpiId: string) {
  await supabaseRest<void>(`/project_kpis?project_id=eq.${enc(projectId)}&kpi_id=eq.${enc(kpiId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

// ── Content matrix ────────────────────────────────────────────────────────

function normalizeContent(row: ContentItem): ContentItem {
  return { ...row, sort_order: toNumber(row.sort_order), brand_id: row.brand_id || null };
}

export async function listContentItems(projectId: string) {
  const rows = await supabaseRest<ContentItem[]>(
    `/content_items?project_id=eq.${enc(projectId)}&select=*&order=publication_date.asc,sort_order.asc,created_at.asc`,
  );
  return rows.map(normalizeContent);
}

export async function createContentItem(projectId: string, companyId: string, userId: string, input: ContentInput & { title: string }) {
  const now = new Date().toISOString();
  const [row] = await supabaseRest<ContentItem[]>("/content_items", {
    method: "POST",
    body: JSON.stringify({
      item_id: makeId("cnt"),
      project_id: projectId,
      company_id: companyId,
      create_date: now.slice(0, 10),
      ...input,
      created_by: userId,
      created_at: now,
      updated_at: now,
    }),
  });
  return normalizeContent(row);
}

export async function updateContentItem(projectId: string, itemId: string, patch: ContentInput) {
  const rows = await supabaseRest<ContentItem[]>(`/content_items?project_id=eq.${enc(projectId)}&item_id=eq.${enc(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  return rows[0] ? normalizeContent(rows[0]) : null;
}

export async function deleteContentItem(projectId: string, itemId: string) {
  await supabaseRest<void>(`/content_items?project_id=eq.${enc(projectId)}&item_id=eq.${enc(itemId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

// ── Aggregate ─────────────────────────────────────────────────────────────

export async function getProjectHubData(projectId: string, companyId: string): Promise<ProjectHubData> {
  const [links, companyBrands, strategy, kpis, content, personas, campaigns] = await Promise.all([
    supabaseRest<Array<{ brand_id: string }>>(`/project_brands?project_id=eq.${enc(projectId)}&select=brand_id`),
    listCompanyBrands(companyId),
    listStrategyOptions(projectId),
    listProjectKpis(projectId),
    listContentItems(projectId),
    listHubRows<AudiencePersona>(personaTable, projectId),
    listHubRows<Campaign>(campaignTable, projectId),
  ]);
  const linked = new Set(links.map((link) => link.brand_id));

  return {
    brands: companyBrands.filter((brand) => linked.has(brand.brand_id)),
    companyBrands,
    strategy,
    kpis,
    content,
    personas: personas.map((persona) => ({ ...persona, sort_order: toNumber(persona.sort_order) })),
    campaigns: campaigns.map((campaign) => ({ ...campaign, budget: campaign.budget === null ? null : toNumber(campaign.budget) })),
  };
}

export async function listProjectBrandIds(projectId: string) {
  const links = await supabaseRest<Array<{ brand_id: string }>>(`/project_brands?project_id=eq.${enc(projectId)}&select=brand_id`);
  return links.map((link) => link.brand_id);
}

// ── API guard ─────────────────────────────────────────────────────────────

type ProjectGuard = { access: ProjectAccess; error?: undefined } | { access?: undefined; error: Response };

/** Route-handler guard: 401 / 404 / 403 responses, else the resolved access. */
export async function requireProjectAccess(projectId: string, mode: "read" | "edit" | "contribute"): Promise<ProjectGuard> {
  const user = await getCurrentUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const access = await getProjectAccess(projectId);
  if (!access) return { error: Response.json({ error: "Project not found" }, { status: 404 }) };
  if (mode === "edit" && !access.canEdit) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  if (mode === "contribute" && !access.canContribute) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { access };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as unknown;
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export function failure(error: unknown, fallback: string) {
  console.error(error);
  return Response.json({ error: fallback }, { status: 502 });
}

/** Pillar target share: null when blank, a 0–100 number, or "invalid". */
export function parseTargetShare(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const share = Number(value);
  return Number.isFinite(share) && share >= 0 && share <= 100 ? share : "invalid";
}

/** A content row may only link to a task of the same project (company-scoped lookup). */
export async function isProjectTask(taskId: string, projectId: string) {
  const task = await getResourceById("Tasks", taskId);
  return Boolean(task && task.project_id === projectId);
}

// ── Social media: personas & campaigns ────────────────────────────────────

type HubTable = { table: "audience_personas" | "campaigns"; idField: "persona_id" | "campaign_id"; prefix: string; order: string };

export const personaTable: HubTable = { table: "audience_personas", idField: "persona_id", prefix: "per", order: "sort_order.asc,created_at.asc" };
export const campaignTable: HubTable = { table: "campaigns", idField: "campaign_id", prefix: "cpg", order: "start_date.asc,created_at.asc" };

export async function listHubRows<T>(spec: HubTable, projectId: string) {
  return supabaseRest<T[]>(`/${spec.table}?project_id=eq.${enc(projectId)}&select=*&order=${spec.order}`);
}

export async function createHubRow<T>(spec: HubTable, projectId: string, companyId: string, input: Record<string, unknown>) {
  const now = new Date().toISOString();
  const [row] = await supabaseRest<T[]>(`/${spec.table}`, {
    method: "POST",
    body: JSON.stringify({ [spec.idField]: makeId(spec.prefix), project_id: projectId, company_id: companyId, ...input, created_at: now, updated_at: now }),
  });
  return row;
}

export async function updateHubRow<T>(spec: HubTable, projectId: string, id: string, patch: Record<string, unknown>) {
  const rows = await supabaseRest<T[]>(`/${spec.table}?project_id=eq.${enc(projectId)}&${spec.idField}=eq.${enc(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  return rows[0] ?? null;
}

export async function deleteHubRow(spec: HubTable, projectId: string, id: string) {
  await supabaseRest<void>(`/${spec.table}?project_id=eq.${enc(projectId)}&${spec.idField}=eq.${enc(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}
