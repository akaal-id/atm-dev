import "server-only";

import { cookies } from "next/headers";

import { sessionCookieName, verifySessionToken } from "@/lib/server/auth";
import {
  ALL_COMPANIES_ID,
  DEFAULT_COMPANY_ID,
  activeCompanyCookieName,
  listCompaniesInOrganization,
  listOrganizationIdsForUser,
  type CompanyScope,
} from "@/lib/server/company-context";
import { activeOrganizationCookieName } from "@/lib/tenant-path";

/**
 * Resolve tenant scope for the current request from session cookie + active company cookie.
 * Avoids calling listResource (prevents circular scoping during auth).
 * - super_admin + cookie `__all__` → every company (platform-wide)
 * - org_owner + cookie `__all__` → every company inside their organization(s)
 * - otherwise → single active company id from cookie (defaults to Akaal)
 */
export async function resolveCompanyScope(): Promise<CompanyScope> {
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
