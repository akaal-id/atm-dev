import "server-only";

import { appDatabaseSchema } from "@/lib/data/schema";
import {
  applySupabaseAuthHeaders,
  getSupabaseSecretKey,
  getSupabaseUrl,
  isJwtIssuedAtFutureError,
  isSupabaseRestConfigured,
} from "@/lib/server/supabase-rest";

export type SupabaseResourceName = keyof typeof appDatabaseSchema;

export const supabaseTables: Record<SupabaseResourceName, string> = {
  Users: "users",
  Departments: "departments",
  Roles: "roles",
  Tasks: "tasks",
  Task_Comments: "task_comments",
  Task_Checklists: "task_checklists",
  Project_Files: "project_files",
  Projects: "projects",
  Workflows: "workflows",
  Attendance: "attendance",
  Leave_Requests: "leave_requests",
  Announcements: "announcements",
  Calendar_Events: "calendar_events",
  Notifications: "notifications",
  Gamification_Points: "gamification_points",
  Badges: "badges",
  User_Badges: "user_badges",
  Activity_Logs: "activity_logs",
  Settings: "settings",
};

export interface SupabaseReadOptions {
  /** PostgREST select list. Defaults to `*`. */
  select?: string;
  filters?: Record<string, string | number | boolean>;
  /** `field=in.(a,b,c)` filters. */
  inFilters?: Record<string, Array<string | number>>;
  /** Raw PostgREST `or=(...)` body, without the outer `or=` key. */
  or?: string;
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
}

const optionalSupabaseFields: Partial<Record<SupabaseResourceName, string[]>> = {
  Attendance: ["active_minutes", "location_count"],
  Tasks: ["need_leader_approval", "handed_off_at", "report"],
};

// Resources whose Supabase table may not exist yet (newly introduced). A missing
// table degrades to an empty list instead of crashing the page that reads it.
const optionalSupabaseResources = new Set<SupabaseResourceName>(["Project_Files"]);

class SupabaseStoreError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly preview?: string,
  ) {
    super(message);
    this.name = "SupabaseStoreError";
  }
}

function stripOptionalFields(resource: SupabaseResourceName, record: Record<string, unknown>) {
  const optionalFields = optionalSupabaseFields[resource] ?? [];
  const next = { ...record };
  let changed = false;

  optionalFields.forEach((field) => {
    if (field in next) {
      delete next[field];
      changed = true;
    }
  });

  return changed ? next : record;
}

function isMissingTableError(error: unknown) {
  if (!(error instanceof SupabaseStoreError) || error.status !== 404) return false;
  const preview = error.preview?.toLowerCase() ?? "";
  return preview.includes("pgrst205") || preview.includes("could not find the table") || preview.includes("does not exist");
}

function canRetryWithoutOptionalFields(resource: SupabaseResourceName, error: unknown, record: Record<string, unknown>) {
  const optionalFields = optionalSupabaseFields[resource] ?? [];
  if (optionalFields.length === 0 || !(error instanceof SupabaseStoreError) || error.status !== 400) return false;
  return optionalFields.some((field) => field in record && error.preview?.includes(field));
}

export function isSupabaseConfigured() {
  return isSupabaseRestConfigured();
}

function assertSupabaseConfig() {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();

  if (!url || !key) {
    throw new SupabaseStoreError("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  return { url, key };
}

async function requestSupabaseOnce<T>(url: string, key: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  applySupabaseAuthHeaders(headers, key);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${url}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    const preview = (await response.text()).slice(0, 500);
    throw new SupabaseStoreError(
      `Supabase request failed for ${path} (${response.status}): ${preview}`,
      response.status,
      preview,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function requestSupabase<T>(path: string, init: RequestInit = {}) {
  const { url, key } = assertSupabaseConfig();

  try {
    return await requestSupabaseOnce<T>(url, key, path, init);
  } catch (error) {
    // Transient gateway/PostgREST clock skew when minting role JWTs from opaque keys.
    if (
      error instanceof SupabaseStoreError &&
      typeof error.status === "number" &&
      typeof error.preview === "string" &&
      isJwtIssuedAtFutureError(error.status, error.preview)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return requestSupabaseOnce<T>(url, key, path, init);
    }
    throw error;
  }
}

function tableFor(resource: SupabaseResourceName) {
  return supabaseTables[resource];
}

function filterById(idField: string, id: string) {
  return `${encodeURIComponent(idField)}=eq.${encodeURIComponent(id)}`;
}

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return { configured: false, mode: "supabase", tables: supabaseTables };
  }

  const rows = await requestSupabase<unknown[]>("/rest/v1/roles?select=role_id&limit=1");
  return {
    configured: true,
    mode: "supabase",
    reachable: true,
    sampledRows: rows.length,
    tables: supabaseTables,
  };
}

export async function readSupabaseResource(resource: SupabaseResourceName, options: SupabaseReadOptions = {}) {
  return readSupabaseResourceWhere(resource, {
    orderBy: options.orderBy ?? "created_at",
    ascending: options.ascending ?? false,
    ...options,
  });
}

export async function readSupabaseResourceWhere(resource: SupabaseResourceName, options: SupabaseReadOptions) {
  const table = tableFor(resource);
  const params = new URLSearchParams({ select: options.select?.trim() || "*" });

  Object.entries(options.filters ?? {}).forEach(([field, value]) => {
    params.set(field, `eq.${String(value)}`);
  });

  Object.entries(options.inFilters ?? {}).forEach(([field, values]) => {
    if (values.length === 0) {
      // Force empty result set without downloading the table.
      params.set(field, "eq.__no_match__");
      return;
    }
    params.set(field, `in.(${values.map((value) => String(value)).join(",")})`);
  });

  if (options.or?.trim()) {
    params.set("or", `(${options.or.trim().replace(/^\(/, "").replace(/\)$/, "")})`);
  }

  if (options.orderBy) {
    params.set("order", `${options.orderBy}.${options.ascending ? "asc" : "desc"}.nullslast`);
  }

  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }

  try {
    return await requestSupabase<Record<string, unknown>[]>(`/rest/v1/${table}?${params.toString()}`);
  } catch (error) {
    if (optionalSupabaseResources.has(resource) && isMissingTableError(error)) return [];
    throw error;
  }
}

export async function insertSupabaseResource(resource: SupabaseResourceName, record: Record<string, unknown>) {
  const table = tableFor(resource);
  let rows: Record<string, unknown>[];

  try {
    rows = await requestSupabase<Record<string, unknown>[]>(`/rest/v1/${table}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(record),
    });
  } catch (error) {
    if (!canRetryWithoutOptionalFields(resource, error, record)) throw error;
    rows = await requestSupabase<Record<string, unknown>[]>(`/rest/v1/${table}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(stripOptionalFields(resource, record)),
    });
  }

  return rows[0];
}

export async function upsertSupabaseResources(resource: SupabaseResourceName, idField: string, records: Array<Record<string, unknown>>) {
  if (records.length === 0) return 0;

  const table = tableFor(resource);
  const batchSize = 250;
  let total = 0;

  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    try {
      await requestSupabase<undefined>(`/rest/v1/${table}?on_conflict=${encodeURIComponent(idField)}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(batch),
      });
    } catch (error) {
      const sampleRecord = batch.find((record) => canRetryWithoutOptionalFields(resource, error, record));
      if (!sampleRecord) throw error;
      await requestSupabase<undefined>(`/rest/v1/${table}?on_conflict=${encodeURIComponent(idField)}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(batch.map((record) => stripOptionalFields(resource, record))),
      });
    }
    total += batch.length;
  }

  return total;
}

export async function updateSupabaseResource(resource: SupabaseResourceName, idField: string, id: string, patch: Record<string, unknown>) {
  const table = tableFor(resource);
  let rows: Record<string, unknown>[];

  try {
    rows = await requestSupabase<Record<string, unknown>[]>(`/rest/v1/${table}?${filterById(idField, id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
  } catch (error) {
    if (!canRetryWithoutOptionalFields(resource, error, patch)) throw error;
    rows = await requestSupabase<Record<string, unknown>[]>(`/rest/v1/${table}?${filterById(idField, id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(stripOptionalFields(resource, patch)),
    });
  }

  return rows[0];
}

export async function deleteSupabaseResource(resource: SupabaseResourceName, idField: string, id: string) {
  const table = tableFor(resource);
  const rows = await requestSupabase<Record<string, unknown>[]>(`/rest/v1/${table}?${filterById(idField, id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });

  return rows.length > 0;
}
