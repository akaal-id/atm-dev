import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { sessionCookieName, verifySessionToken } from "@/lib/server/auth";
import {
  ALL_COMPANIES_ID,
  DEFAULT_COMPANY_ID,
  activeCompanyCookieName,
  listCompaniesInOrganization,
  listOrganizationIdsForUser,
  type CompanyScope,
} from "@/lib/server/company-context";
import type { SupabaseReadOptions } from "@/lib/server/supabase-store";
import { activeOrganizationCookieName } from "@/lib/tenant-path";

/**
 * Resolve tenant scope for the current request from session cookie + active company cookie.
 * Avoids calling listResource (prevents circular scoping during auth).
 * - super_admin + cookie `__all__` → every company (platform-wide)
 * - org_owner + cookie `__all__` → every company inside their organization(s)
 * - otherwise → single active company id from cookie (defaults to Akaal)
 *
 * Cached per React request so parallel listResource calls share one scope resolution.
 */
export const resolveCompanyScope = cache(async function resolveCompanyScope(): Promise<CompanyScope> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isSuperAdmin = session?.roleId === "super_admin";
  const isOrgOwner = session?.roleId === "org_owner";
  const cookieValue = cookieStore.get(activeCompanyCookieName)?.value?.trim() || "";

  if ((isSuperAdmin || isOrgOwner) && cookieValue === ALL_COMPANIES_ID) {
    const orgCookie = cookieStore.get(activeOrganizationCookieName)?.value?.trim() || "";

    // Super admin inside a specific org URL → all companies in that org only.
    if (isSuperAdmin && orgCookie && orgCookie !== "all" && orgCookie !== ALL_COMPANIES_ID) {
      try {
        const orgCompanies = await listCompaniesInOrganization(orgCookie);
        return {
          mode: "org",
          companyId: null,
          isSuperAdmin: true,
          allowedCompanyIds: orgCompanies.map((company) => company.id),
        };
      } catch (error) {
        console.error("super_admin org-scoped all-companies failed", error);
      }
    }

    if (isSuperAdmin) {
      return { mode: "all", companyId: null, isSuperAdmin: true, allowedCompanyIds: null };
    }
  }

  if (isOrgOwner && cookieValue === ALL_COMPANIES_ID && session?.userId) {
    try {
      const orgIds = await listOrganizationIdsForUser(session.userId);
      const companyLists = await Promise.all(orgIds.map((orgId) => listCompaniesInOrganization(orgId)));
      const allowedCompanyIds = companyLists.flat().map((company) => company.id);
      return {
        mode: "org",
        companyId: null,
        isSuperAdmin: false,
        allowedCompanyIds,
      };
    } catch (error) {
      console.error("org_owner all-companies scope failed", error);
    }
  }

  const companyId =
    cookieValue && cookieValue !== ALL_COMPANIES_ID ? cookieValue : DEFAULT_COMPANY_ID;

  return {
    mode: "single",
    companyId,
    isSuperAdmin: Boolean(isSuperAdmin),
    allowedCompanyIds: null,
  };
});

/** Legacy rows may store Akaal as empty/`null` company_id — include those when scoped to default. */
function akaalLegacyCompanyOr(companyIds: string[]) {
  const inList = companyIds.join(",");
  return `company_id.in.(${inList}),company_id.eq.,company_id.is.null`;
}

/**
 * Push tenant scope into PostgREST so list reads do not download every company's rows.
 * Returns empty options for platform-wide (`all`) scope.
 */
export function companyScopeToSupabaseOptions(scope: CompanyScope): Pick<SupabaseReadOptions, "filters" | "inFilters" | "or"> {
  if (scope.mode === "all") return {};

  if (scope.mode === "single") {
    if (scope.companyId === DEFAULT_COMPANY_ID) {
      return { or: akaalLegacyCompanyOr([scope.companyId]) };
    }
    return { filters: { company_id: scope.companyId } };
  }

  const ids = Array.from(new Set(scope.allowedCompanyIds.filter(Boolean)));
  if (ids.length === 0) return { filters: { company_id: "__no_match__" } };
  if (ids.includes(DEFAULT_COMPANY_ID)) {
    return { or: akaalLegacyCompanyOr(ids) };
  }
  return { inFilters: { company_id: ids } };
}

export function recordMatchesCompanyScope(
  record: Record<string, unknown>,
  scope: CompanyScope,
  options?: { allowEmptyAsAkaal?: boolean },
) {
  if (scope.mode === "all") return true;
  if (scope.mode === "org") {
    const companyId = String(record.company_id ?? "").trim();
    if (!companyId) return scope.allowedCompanyIds.includes(DEFAULT_COMPANY_ID);
    return scope.allowedCompanyIds.includes(companyId);
  }
  const companyId = String(record.company_id ?? "").trim();
  if (!companyId) {
    return options?.allowEmptyAsAkaal === false ? false : scope.companyId === DEFAULT_COMPANY_ID;
  }
  return companyId === scope.companyId;
}

export function filterRowsByCompanyScope<T extends Record<string, unknown>>(rows: T[], scope: CompanyScope) {
  if (scope.mode === "all") return rows;
  return rows.filter((row) => recordMatchesCompanyScope(row, scope));
}
