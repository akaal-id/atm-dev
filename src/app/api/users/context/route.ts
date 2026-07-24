import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import {
  ALL_COMPANIES_ID,
  DEFAULT_ORGANIZATION_ID,
  activeCompanyCookieName,
  activeCompanyCookieOptions,
  companyHasErpAccess,
  findCompanyById,
  getActiveCompanyContext,
  listCompaniesInOrganization,
  readActiveCompanyIdCookie,
  readActiveOrganizationIdCookie,
  userCanAccessCompany,
  userCanManageOrganization,
} from "@/lib/server/company-context";
import { activeOrganizationCookieName, TENANT_ALL } from "@/lib/tenant-path";

const allCompaniesView = {
  id: ALL_COMPANIES_ID,
  organization_id: DEFAULT_ORGANIZATION_ID,
  name: "All companies",
  created_at: "",
};

/**
 * GET /api/users/context
 * Returns the signed-in user's active company (and memberships) for tenant scoping.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const context = await getActiveCompanyContext(user.user_id);
  const canManage =
    (await userCanManageOrganization(user.user_id, context.organization?.id)) ||
    user.role_id === "super_admin" ||
    user.role_id === "org_owner" ||
    user.role_id === "admin";
  const isSuperAdmin = user.role_id === "super_admin";
  const isOrgOwner = user.role_id === "org_owner";
  const cookie = await readActiveCompanyIdCookie();
  const orgCookie = await readActiveOrganizationIdCookie();
  const viewingAll =
    (isSuperAdmin || isOrgOwner) && cookie === ALL_COMPANIES_ID;

  const activeCompany = viewingAll ? allCompaniesView : context.company;
  const activeOrganizationId = viewingAll
    ? isSuperAdmin
      ? orgCookie && orgCookie !== TENANT_ALL
        ? orgCookie
        : TENANT_ALL
      : context.organization?.id || DEFAULT_ORGANIZATION_ID
    : context.organization?.id || context.company.organization_id || DEFAULT_ORGANIZATION_ID;

  const response = NextResponse.json({
    user_id: user.user_id,
    role_id: user.role_id,
    active_company_id: activeCompany.id,
    active_organization_id: activeOrganizationId,
    company: activeCompany,
    organization: context.organization,
    organizations: context.organizations,
    membership: context.membership,
    companies: context.companies,
    can_manage_organization: canManage,
    can_view_all_companies: isSuperAdmin || isOrgOwner,
    viewing_all_companies: viewingAll,
    viewing_all_organizations: isSuperAdmin && activeOrganizationId === TENANT_ALL,
    company_verified: viewingAll ? true : Boolean(context.company.is_verified),
    billing_status: viewingAll ? "active" : context.company.billing_status || "pending_payment",
    needs_payment: viewingAll ? false : !companyHasErpAccess(context.company),
  });

  // Read-only: do not rewrite tenant cookies on GET. Proxy (URL) + PUT own cookie writes.
  // Re-setting cookies here raced with the tenant URL and could trigger refresh storms.
  return response;
}

/**
 * PUT /api/users/context
 * Body:
 * - { company_id: string } — use `__all__` for org/platform-wide company view
 * - { organization_id: string } — super_admin only; switches into that org (first company)
 */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    company_id?: string;
    organization_id?: string;
  } | null;

  const organizationId = String(body?.organization_id ?? "").trim();
  if (organizationId) {
    if (user.role_id !== "super_admin") {
      return NextResponse.json({ error: "Only super admins can switch organization" }, { status: 403 });
    }

    if (organizationId === TENANT_ALL || organizationId === ALL_COMPANIES_ID) {
      const response = NextResponse.json({
        ok: true,
        active_company_id: ALL_COMPANIES_ID,
        active_organization_id: TENANT_ALL,
        company: allCompaniesView,
        organization: null,
        viewing_all_companies: true,
        viewing_all_organizations: true,
      });
      response.cookies.set(activeCompanyCookieName, ALL_COMPANIES_ID, activeCompanyCookieOptions());
      response.cookies.set(activeOrganizationCookieName, TENANT_ALL, activeCompanyCookieOptions());
      return response;
    }

    const orgCompanies = await listCompaniesInOrganization(organizationId);
    if (orgCompanies.length === 0) {
      return NextResponse.json({ error: "Organization has no companies yet" }, { status: 404 });
    }

    const company = orgCompanies[0];
    const context = await getActiveCompanyContext(user.user_id);
    const organization =
      context.organizations.find((item) => item.id === organizationId) ||
      context.organization ||
      null;

    const response = NextResponse.json({
      ok: true,
      active_company_id: company.id,
      active_organization_id: organizationId,
      company,
      organization,
      companies: orgCompanies,
      viewing_all_companies: false,
      viewing_all_organizations: false,
    });
    response.cookies.set(activeCompanyCookieName, company.id, activeCompanyCookieOptions());
    response.cookies.set(activeOrganizationCookieName, organizationId, activeCompanyCookieOptions());
    return response;
  }

  const companyId = String(body?.company_id ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "company_id or organization_id is required" }, { status: 400 });
  }

  if (companyId === ALL_COMPANIES_ID) {
    if (user.role_id !== "super_admin" && user.role_id !== "org_owner") {
      return NextResponse.json({ error: "Only org owners and super admins can view all companies" }, { status: 403 });
    }
    const context = await getActiveCompanyContext(user.user_id);
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const preferredOrg =
      jar.get(activeOrganizationCookieName)?.value?.trim() ||
      context.organization?.id ||
      DEFAULT_ORGANIZATION_ID;
    const orgForAll =
      user.role_id === "super_admin" && preferredOrg && preferredOrg !== TENANT_ALL
        ? preferredOrg
        : user.role_id === "super_admin"
          ? TENANT_ALL
          : preferredOrg;

    const response = NextResponse.json({
      ok: true,
      active_company_id: ALL_COMPANIES_ID,
      active_organization_id: orgForAll,
      company: allCompaniesView,
      viewing_all_companies: true,
    });
    response.cookies.set(activeCompanyCookieName, ALL_COMPANIES_ID, activeCompanyCookieOptions());
    response.cookies.set(activeOrganizationCookieName, orgForAll, activeCompanyCookieOptions());
    return response;
  }

  const allowed = await userCanAccessCompany(user.user_id, companyId);
  if (!allowed) {
    return NextResponse.json({ error: "You do not have access to this company" }, { status: 403 });
  }

  const company = await findCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const response = NextResponse.json({
    ok: true,
    active_company_id: companyId,
    active_organization_id: company.organization_id || DEFAULT_ORGANIZATION_ID,
    company,
    viewing_all_companies: false,
  });
  response.cookies.set(activeCompanyCookieName, companyId, activeCompanyCookieOptions());
  response.cookies.set(
    activeOrganizationCookieName,
    company.organization_id || DEFAULT_ORGANIZATION_ID,
    activeCompanyCookieOptions(),
  );
  return response;
}
