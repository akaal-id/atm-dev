import "server-only";

import { cookies } from "next/headers";

import { isSupabaseConfigured } from "@/lib/server/supabase-store";
import { activeOrganizationCookieName as organizationCookieName } from "@/lib/tenant-path";
import type { Company, CompanyUser, Organization } from "@/lib/types";

export const activeCompanyCookieName = "active_company_id";

/** Cookie / scope value meaning "show every company" (super_admin only). */
export const ALL_COMPANIES_ID = "__all__";

/** First Akaal tenant created during the multi-tenant pivot. */
export const DEFAULT_ORGANIZATION_ID = "org_akaal";
export const DEFAULT_COMPANY_ID = "cmp_akaal";

export type CompanyScope =
  | { mode: "all"; companyId: null; isSuperAdmin: true; allowedCompanyIds: null }
  | { mode: "org"; companyId: null; isSuperAdmin: boolean; allowedCompanyIds: string[] }
  | { mode: "single"; companyId: string; isSuperAdmin: boolean; allowedCompanyIds: null };

export const defaultOrganization: Organization = {
  id: DEFAULT_ORGANIZATION_ID,
  name: "Akaal",
  slug: "akaal",
  legal_name: "Akaal",
  billing_status: "active",
  subscription_plan: "enterprise",
  subscription_interval: "monthly",
  is_active: true,
  is_verified: true,
  verified_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
};

export const defaultCompany: Company = {
  id: DEFAULT_COMPANY_ID,
  organization_id: DEFAULT_ORGANIZATION_ID,
  name: "Akaal",
  slug: "akaal",
  legal_name: "Akaal",
  timezone: "Asia/Jakarta",
  is_active: true,
  is_verified: true,
  verified_at: "2026-01-01T00:00:00.000Z",
  billing_status: "active",
  subscription_plan: "enterprise",
  subscription_interval: "monthly",
  monthly_price_cents: 0,
  currency: "IDR",
  created_at: "2026-01-01T00:00:00.000Z",
};

/** Dummy starter plan shown on the paywall (IDR, whole rupiah). */
export const DEFAULT_MONTHLY_PRICE_CENTS = 499_000;

/** In-memory fallback when ATM_DATA_MODE is not supabase (local seed). */
const seedModeCompanies = new Map<string, Company>([[DEFAULT_COMPANY_ID, defaultCompany]]);
const seedModeMemberships: CompanyUser[] = [];

export function listSeedModeCompaniesForUser(userId: string) {
  const memberCompanyIds = new Set(
    seedModeMemberships.filter((item) => item.user_id === userId).map((item) => item.company_id),
  );
  memberCompanyIds.add(DEFAULT_COMPANY_ID);
  return [...seedModeCompanies.values()].filter((company) => memberCompanyIds.has(company.id));
}

export type ActiveCompanyContext = {
  company: Company;
  organization: Organization | null;
  membership: CompanyUser | null;
  companies: Company[];
  organizations: Organization[];
};

function supabaseUrl() {
  const explicitUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");
  const projectId = process.env.SUPABASE_PROJECT_ID;
  return projectId ? `https://${projectId}.supabase.co` : "";
}

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

async function requestSupabase<T>(path: string, init: RequestInit = {}) {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) throw new Error("Supabase is not configured.");

  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${url}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    const preview = (await response.text()).slice(0, 400);
    throw new Error(`Supabase company-context request failed (${response.status}): ${preview}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function listMemberships(userId: string) {
  const params = new URLSearchParams({
    select: "*",
    user_id: `eq.${userId}`,
  });
  return (await requestSupabase<CompanyUser[]>(`/rest/v1/company_users?${params.toString()}`)) ?? [];
}

async function listCompanyMemberships(companyId: string) {
  const params = new URLSearchParams({
    select: "*",
    company_id: `eq.${companyId}`,
  });
  return (await requestSupabase<CompanyUser[]>(`/rest/v1/company_users?${params.toString()}`)) ?? [];
}

async function listCompaniesByIds(ids: string[]) {
  if (ids.length === 0) return [] as Company[];
  const params = new URLSearchParams({
    select: "*",
    id: `in.(${ids.map(encodeURIComponent).join(",")})`,
    order: "name.asc",
  });
  return (await requestSupabase<Company[]>(`/rest/v1/companies?${params.toString()}`)) ?? [];
}

async function getCompanyById(companyId: string) {
  const params = new URLSearchParams({
    select: "*",
    id: `eq.${companyId}`,
    limit: "1",
  });
  const rows = (await requestSupabase<Company[]>(`/rest/v1/companies?${params.toString()}`)) ?? [];
  return rows[0] ?? null;
}

/** Public lookup for API routes that already passed an access check. */
export async function findCompanyById(companyId: string) {
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return seedModeCompanies.get(companyId) ?? (companyId === DEFAULT_COMPANY_ID ? defaultCompany : null);
  }
  try {
    return await getCompanyById(companyId);
  } catch (error) {
    console.error("findCompanyById failed", error);
    return null;
  }
}

async function getOrganizationById(organizationId: string) {
  const params = new URLSearchParams({
    select: "*",
    id: `eq.${organizationId}`,
    limit: "1",
  });
  const rows = (await requestSupabase<Organization[]>(`/rest/v1/organizations?${params.toString()}`)) ?? [];
  return rows[0] ?? null;
}

/** Public lookup for tenant gate / API routes. */
export async function findOrganizationById(organizationId: string) {
  if (!organizationId) return null;
  if (organizationId === DEFAULT_ORGANIZATION_ID) {
    if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
      return defaultOrganization;
    }
  }
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return organizationId === DEFAULT_ORGANIZATION_ID ? defaultOrganization : null;
  }
  try {
    return await getOrganizationById(organizationId);
  } catch (error) {
    console.error("findOrganizationById failed", error);
    return null;
  }
}

async function listOrganizationsByIds(ids: string[]) {
  if (ids.length === 0) return [] as Organization[];
  const params = new URLSearchParams({
    select: "*",
    id: `in.(${ids.map(encodeURIComponent).join(",")})`,
    order: "name.asc",
  });
  return (await requestSupabase<Organization[]>(`/rest/v1/organizations?${params.toString()}`)) ?? [];
}

export async function listAllOrganizations() {
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return [defaultOrganization];
  }
  const params = new URLSearchParams({
    select: "*",
    order: "name.asc",
  });
  return (await requestSupabase<Organization[]>(`/rest/v1/organizations?${params.toString()}`)) ?? [];
}

async function getOrganizationBySlug(slug: string) {
  const params = new URLSearchParams({
    select: "*",
    slug: `eq.${slug}`,
    limit: "1",
  });
  const rows = (await requestSupabase<Organization[]>(`/rest/v1/organizations?${params.toString()}`)) ?? [];
  return rows[0] ?? null;
}

/** Public signup lookup — resolve org by id or slug, return companies for joining. */
export async function lookupOrganizationForSignup(organizationRef: string) {
  const ref = organizationRef.trim();
  if (!ref) return null;

  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    if (ref === DEFAULT_ORGANIZATION_ID || ref === "akaal") {
      return {
        organization: defaultOrganization,
        companies: [defaultCompany],
      };
    }
    return null;
  }

  const organization =
    (await getOrganizationById(ref)) ??
    (await getOrganizationBySlug(ref.toLowerCase())) ??
    null;
  if (!organization || organization.is_active === false) return null;

  const companies = (await listCompaniesInOrganization(organization.id)).filter(
    (company) => company.is_active !== false,
  );

  return { organization, companies };
}

export async function readActiveCompanyIdCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(activeCompanyCookieName)?.value?.trim() || "";
}

export async function readActiveOrganizationIdCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(organizationCookieName)?.value?.trim() || "";
}

export function activeCompanyCookieOptions(maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Resolve the signed-in user's active company from cookie + memberships.
 * Falls back to the seeded Akaal company during the single-tenant → multi-tenant pivot.
 */
export async function getActiveCompanyContext(userId: string): Promise<ActiveCompanyContext> {
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    const companies = listSeedModeCompaniesForUser(userId);
    const preferredId = await readActiveCompanyIdCookie();
    const active =
      companies.find((company) => company.id === preferredId) ??
      companies.find((company) => company.id === DEFAULT_COMPANY_ID) ??
      companies[0] ??
      defaultCompany;
    const membership =
      seedModeMemberships.find((item) => item.user_id === userId && item.company_id === active.id) ?? {
        company_id: active.id,
        user_id: userId,
        role: "staff",
      };

    return {
      company: active,
      organization: defaultOrganization,
      membership,
      companies: companies.length > 0 ? companies : [defaultCompany],
      organizations: [defaultOrganization],
    };
  }

  try {
    const memberships = await listMemberships(userId);
    const companyIds = new Set(memberships.map((item) => item.company_id));

    // Org owners / org admins see every company under their organization(s).
    try {
      const orgIds = await listOrganizationIdsForUser(userId);
      for (const orgId of orgIds) {
        const orgCompanies = await listCompaniesInOrganization(orgId);
        for (const company of orgCompanies) companyIds.add(company.id);
      }
    } catch (error) {
      console.error("org company expansion failed", error);
    }

    let companies = await listCompaniesByIds([...companyIds]);

    if (companies.length === 0) {
      const akaal = (await getCompanyById(DEFAULT_COMPANY_ID)) ?? defaultCompany;
      companies = [akaal];
    }

    const preferredId = await readActiveCompanyIdCookie();
    let active = preferredId
      ? companies.find((company) => company.id === preferredId)
      : undefined;

    // URL/cookie may point at a company not yet in the membership cache (e.g. super_admin
    // deep-link). Resolve it explicitly instead of silently falling back to Akaal while the
    // browser URL still shows another tenant.
    if (!active && preferredId && preferredId !== ALL_COMPANIES_ID) {
      const preferredCompany = await getCompanyById(preferredId);
      if (preferredCompany) {
        const { getSession } = await import("@/lib/server/auth");
        const session = await getSession();
        const isSuperAdmin = session?.roleId === "super_admin";
        let allowed = isSuperAdmin || companyIds.has(preferredCompany.id);
        if (!allowed) {
          const orgIds = await listOrganizationIdsForUser(userId);
          allowed = orgIds.includes(preferredCompany.organization_id);
        }
        if (allowed) {
          active = preferredCompany;
          if (!companies.some((company) => company.id === preferredCompany.id)) {
            companies = [...companies, preferredCompany].sort((left, right) =>
              left.name.localeCompare(right.name),
            );
          }
        }
      }
    }

    if (!active) {
      active =
        companies.find((company) => company.id === DEFAULT_COMPANY_ID) ?? companies[0] ?? defaultCompany;
    }

    const membership = memberships.find((item) => item.company_id === active.id) ?? null;
    const organization = (await getOrganizationById(active.organization_id)) ?? defaultOrganization;
    const { getSession } = await import("@/lib/server/auth");
    const session = await getSession();
    const isSuperAdmin = session?.roleId === "super_admin";

    let organizations: Organization[];
    if (isSuperAdmin) {
      organizations = await listAllOrganizations();
      if (organizations.length === 0) organizations = [defaultOrganization];

      // Ensure the active org's full company list is available for the company switcher.
      try {
        const orgCompanies = await listCompaniesInOrganization(active.organization_id);
        const known = new Set(companies.map((company) => company.id));
        for (const company of orgCompanies) {
          if (!known.has(company.id)) companies.push(company);
        }
        companies = [...companies].sort((left, right) => left.name.localeCompare(right.name));
      } catch (error) {
        console.error("super_admin org company expansion failed", error);
      }
    } else {
      const orgIdsForList = [...new Set(companies.map((company) => company.organization_id).filter(Boolean))];
      organizations = await listOrganizationsByIds(orgIdsForList);
      if (organization && !organizations.some((item) => item.id === organization.id)) {
        organizations = [organization, ...organizations];
      }
      if (organizations.length === 0) organizations = [defaultOrganization];
    }

    return {
      company: active,
      organization,
      membership,
      companies,
      organizations,
    };
  } catch (error) {
    console.error("getActiveCompanyContext failed; falling back to Akaal default", error);
    return {
      company: defaultCompany,
      organization: defaultOrganization,
      membership: {
        company_id: DEFAULT_COMPANY_ID,
        user_id: userId,
        role: "staff",
      },
      companies: [defaultCompany],
      organizations: [defaultOrganization],
    };
  }
}

/** User IDs that belong to a company (falls back to empty when offline/seed mode). */
export async function listCompanyMemberUserIds(companyId: string): Promise<string[]> {
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return [];
  }

  try {
    const memberships = await listCompanyMemberships(companyId);
    return memberships.map((item) => item.user_id);
  } catch (error) {
    console.error("listCompanyMemberUserIds failed", error);
    return [];
  }
}

export type EmployeeCompanyAccess = CompanyUser & { company: Company | null };

/** Companies a user can access (membership rows + company records). */
export async function listEmployeeCompanies(userId: string): Promise<EmployeeCompanyAccess[]> {
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return [
      {
        company_id: DEFAULT_COMPANY_ID,
        user_id: userId,
        role: "staff",
        company: defaultCompany,
      },
    ];
  }

  const memberships = await listMemberships(userId);
  if (memberships.length === 0) {
    return [
      {
        company_id: DEFAULT_COMPANY_ID,
        user_id: userId,
        role: "staff",
        company: (await getCompanyById(DEFAULT_COMPANY_ID)) ?? defaultCompany,
      },
    ];
  }

  const companies = await listCompaniesByIds(memberships.map((item) => item.company_id));
  const byId = new Map(companies.map((company) => [company.id, company]));

  return memberships.map((membership) => ({
    ...membership,
    company: byId.get(membership.company_id) ?? null,
  }));
}

export async function addEmployeeToCompany(input: {
  userId: string;
  companyId: string;
  role?: string;
}) {
  const role = (input.role || "staff").trim() || "staff";
  const now = new Date().toISOString();

  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return {
      company_id: input.companyId,
      user_id: input.userId,
      role,
      created_at: now,
      updated_at: now,
    } satisfies CompanyUser;
  }

  const company = await getCompanyById(input.companyId);
  if (!company) throw new Error("Company not found");

  const rows = await requestSupabase<CompanyUser[]>("/rest/v1/company_users?on_conflict=company_id,user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      company_id: input.companyId,
      user_id: input.userId,
      role,
      created_at: now,
      updated_at: now,
    }),
  });

  return rows?.[0] ?? {
    company_id: input.companyId,
    user_id: input.userId,
    role,
    created_at: now,
    updated_at: now,
  };
}

export async function removeEmployeeFromCompany(userId: string, companyId: string) {
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return true;
  }

  const params = new URLSearchParams({
    company_id: `eq.${companyId}`,
    user_id: `eq.${userId}`,
  });

  await requestSupabase(`/rest/v1/company_users?${params.toString()}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  return true;
}

export async function userCanAccessCompany(userId: string, companyId: string) {
  const { getSession } = await import("@/lib/server/auth");
  const session = await getSession();
  if (session?.roleId === "super_admin") return true;

  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return listSeedModeCompaniesForUser(userId).some((company) => company.id === companyId);
  }

  try {
    const company = await getCompanyById(companyId);
    if (!company) return false;

    const memberships = await listMemberships(userId);
    if (memberships.some((item) => item.company_id === companyId)) return true;

    const orgIds = await listOrganizationIdsForUser(userId);
    return orgIds.includes(company.organization_id);
  } catch (error) {
    console.error("userCanAccessCompany failed", error);
    return false;
  }
}

export async function userCanManageOrganization(userId: string, organizationId = DEFAULT_ORGANIZATION_ID) {
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return true;
  }

  try {
    const params = new URLSearchParams({
      select: "role",
      organization_id: `eq.${organizationId}`,
      user_id: `eq.${userId}`,
      limit: "1",
    });
    const rows =
      (await requestSupabase<Array<{ role: string }>>(`/rest/v1/organization_users?${params.toString()}`)) ?? [];
    if (rows[0]?.role === "org_owner" || rows[0]?.role === "org_admin") return true;
  } catch (error) {
    console.error("userCanManageOrganization lookup failed", error);
  }

  // Fallback: company admins on the default tenant can create companies during the pivot.
  const memberships = await listMemberships(userId);
  return memberships.some((item) => ["super_admin", "admin", "org_owner", "org_admin"].includes(item.role));
}

export async function createCompanyForOrganization(input: {
  name: string;
  organizationId?: string;
  creatorUserId: string;
  creatorRole?: string;
  /** When true (default for new paid tenants), company starts behind the paywall. */
  requirePayment?: boolean;
  industry?: string;
  email?: string;
  phone?: string;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Company name is required");

  const organizationId = input.organizationId || DEFAULT_ORGANIZATION_ID;
  const now = new Date().toISOString();
  const slugBase =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "company";
  const id = `cmp_${slugBase.replace(/-/g, "_").slice(0, 24)}_${Date.now().toString(36)}`;
  const requirePayment = input.requirePayment !== false && organizationId !== DEFAULT_ORGANIZATION_ID;

  const companyPayload: Company = {
    id,
    organization_id: organizationId,
    name,
    slug: slugBase,
    legal_name: name,
    industry: input.industry ?? "",
    email: input.email ?? "",
    phone: input.phone ?? "",
    timezone: "Asia/Jakarta",
    is_active: true,
    is_verified: !requirePayment,
    verified_at: requirePayment ? "" : now,
    billing_status: requirePayment ? "pending_payment" : "active",
    subscription_plan: requirePayment ? "starter" : "enterprise",
    subscription_interval: "monthly",
    monthly_price_cents: requirePayment ? DEFAULT_MONTHLY_PRICE_CENTS : 0,
    currency: "IDR",
    created_at: now,
    updated_at: now,
  };

  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    seedModeCompanies.set(id, companyPayload);
    seedModeMemberships.push({
      company_id: id,
      user_id: input.creatorUserId,
      role: input.creatorRole || "admin",
      created_at: now,
      updated_at: now,
    });
    return companyPayload;
  }

  const companyRows = await requestSupabase<Company[]>("/rest/v1/companies", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(companyPayload),
  });

  const company = companyRows?.[0];
  if (!company) throw new Error("Failed to create company");

  await addEmployeeToCompany({
    userId: input.creatorUserId,
    companyId: company.id,
    role: input.creatorRole || "admin",
  });

  return company;
}

function slugifyName(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "organization"
  );
}

export async function createOrganizationWithOwner(input: {
  organizationName: string;
  companyName: string;
  ownerUserId: string;
  ownerEmail?: string;
  ownerPhone?: string;
}) {
  const organizationName = input.organizationName.trim();
  const companyName = input.companyName.trim() || organizationName;
  if (!organizationName) throw new Error("Organization name is required");

  const now = new Date().toISOString();
  const slug = slugifyName(organizationName);
  const organizationId = `org_${slug.replace(/-/g, "_").slice(0, 24)}_${Date.now().toString(36)}`;

  const organization: Organization = {
    id: organizationId,
    name: organizationName,
    slug,
    legal_name: organizationName,
    email: input.ownerEmail ?? "",
    phone: input.ownerPhone ?? "",
    billing_email: input.ownerEmail ?? "",
    owner_user_id: input.ownerUserId,
    billing_status: "pending_payment",
    subscription_plan: "starter",
    subscription_interval: "monthly",
    is_active: true,
    is_verified: false,
    created_at: now,
    updated_at: now,
  };

  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    const company = await createCompanyForOrganization({
      name: companyName,
      organizationId,
      creatorUserId: input.ownerUserId,
      creatorRole: "org_owner",
      requirePayment: true,
      email: input.ownerEmail,
      phone: input.ownerPhone,
    });
    return { organization, company };
  }

  const orgRows = await requestSupabase<Organization[]>("/rest/v1/organizations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(organization),
  });
  const createdOrg = orgRows?.[0];
  if (!createdOrg) throw new Error("Failed to create organization");

  await requestSupabase("/rest/v1/organization_users", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      organization_id: createdOrg.id,
      user_id: input.ownerUserId,
      role: "org_owner",
      created_at: now,
      updated_at: now,
    }),
  });

  const company = await createCompanyForOrganization({
    name: companyName,
    organizationId: createdOrg.id,
    creatorUserId: input.ownerUserId,
    creatorRole: "org_owner",
    requirePayment: true,
    email: input.ownerEmail,
    phone: input.ownerPhone,
  });

  return { organization: createdOrg, company };
}

export async function listCompaniesInOrganization(organizationId: string) {
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return [...seedModeCompanies.values()].filter((company) => company.organization_id === organizationId);
  }
  const params = new URLSearchParams({
    select: "*",
    organization_id: `eq.${organizationId}`,
    order: "name.asc",
  });
  return (await requestSupabase<Company[]>(`/rest/v1/companies?${params.toString()}`)) ?? [];
}

export async function listOrganizationIdsForUser(userId: string) {
  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    return [DEFAULT_ORGANIZATION_ID];
  }
  const params = new URLSearchParams({
    select: "organization_id",
    user_id: `eq.${userId}`,
  });
  const rows =
    (await requestSupabase<Array<{ organization_id: string }>>(`/rest/v1/organization_users?${params.toString()}`)) ??
    [];
  return [...new Set(rows.map((row) => row.organization_id))];
}

export async function simulateCompanyPayment(companyId: string, actorUserId: string) {
  const now = new Date();
  const startedAt = now.toISOString();
  const expires = new Date(now);
  expires.setMonth(expires.getMonth() + 1);
  const expiresAt = expires.toISOString();

  if (!isSupabaseConfigured() || process.env.ATM_DATA_MODE !== "supabase") {
    const existing = seedModeCompanies.get(companyId);
    if (!existing) throw new Error("Company not found");
    const updated: Company = {
      ...existing,
      is_verified: true,
      verified_at: startedAt,
      billing_status: "active",
      subscription_started_at: startedAt,
      subscription_expires_at: expiresAt,
      last_payment_at: startedAt,
      updated_at: startedAt,
    };
    seedModeCompanies.set(companyId, updated);
    return updated;
  }

  const params = new URLSearchParams({ id: `eq.${companyId}` });
  const rows = await requestSupabase<Company[]>(`/rest/v1/companies?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      is_verified: true,
      verified_at: startedAt,
      billing_status: "active",
      subscription_started_at: startedAt,
      subscription_expires_at: expiresAt,
      last_payment_at: startedAt,
      updated_at: startedAt,
      metadata: { last_simulated_payment_by: actorUserId },
    }),
  });

  const company = rows?.[0];
  if (!company) throw new Error("Failed to verify company payment");

  // Mirror org verified when at least one paid company exists.
  if (company.organization_id) {
    const orgParams = new URLSearchParams({ id: `eq.${company.organization_id}` });
    await requestSupabase(`/rest/v1/organizations?${orgParams.toString()}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        is_verified: true,
        verified_at: startedAt,
        billing_status: "active",
        updated_at: startedAt,
      }),
    });
  }

  return company;
}

export function companyHasErpAccess(company: Company | null | undefined) {
  if (!company) return false;
  if (company.id === DEFAULT_COMPANY_ID || company.organization_id === DEFAULT_ORGANIZATION_ID) return true;
  return Boolean(company.is_verified) && company.billing_status === "active";
}
