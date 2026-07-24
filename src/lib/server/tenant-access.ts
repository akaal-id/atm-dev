import "server-only";

import {
  ALL_COMPANIES_ID,
  findCompanyById,
  findOrganizationById,
  listOrganizationIdsForUser,
  readActiveCompanyIdCookie,
  readActiveOrganizationIdCookie,
  userCanAccessCompany,
} from "@/lib/server/company-context";
import { TENANT_ALL } from "@/lib/tenant-path";

export type TenantAccessResult = { status: "ok" } | { status: "not_found" } | { status: "forbidden" };

type TenantUser = {
  user_id: string;
  role_id: string;
};

/**
 * Validate the tenant org/company cookies (set from the URL by proxy) against
 * existence + membership. Used when a user manually types a tenant URL.
 */
export async function assertTenantAccess(user: TenantUser): Promise<TenantAccessResult> {
  const orgId = await readActiveOrganizationIdCookie();
  const companyId = await readActiveCompanyIdCookie();
  const isSuperAdmin = user.role_id === "super_admin";
  const isOrgOwner = user.role_id === "org_owner";

  // No tenant cookies yet (edge/legacy) — let normal context resolve.
  if (!orgId && !companyId) return { status: "ok" };

  const viewingAllOrgs = !orgId || orgId === TENANT_ALL;
  const viewingAllCompanies = !companyId || companyId === ALL_COMPANIES_ID;

  if (viewingAllOrgs) {
    if (!isSuperAdmin) return { status: "forbidden" };
    if (viewingAllCompanies) return { status: "ok" };
    const company = await findCompanyById(companyId);
    return company ? { status: "ok" } : { status: "not_found" };
  }

  const organization = await findOrganizationById(orgId);
  if (!organization) return { status: "not_found" };

  if (viewingAllCompanies) {
    if (isSuperAdmin) return { status: "ok" };
    if (isOrgOwner) {
      const orgIds = await listOrganizationIdsForUser(user.user_id);
      return orgIds.includes(orgId) ? { status: "ok" } : { status: "forbidden" };
    }
    return { status: "forbidden" };
  }

  const company = await findCompanyById(companyId);
  if (!company) return { status: "not_found" };
  if (company.organization_id !== orgId) return { status: "not_found" };

  if (isSuperAdmin) return { status: "ok" };

  const allowed = await userCanAccessCompany(user.user_id, companyId);
  return allowed ? { status: "ok" } : { status: "forbidden" };
}
