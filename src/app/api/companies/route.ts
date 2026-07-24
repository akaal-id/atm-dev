import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import {
  activeCompanyCookieName,
  activeCompanyCookieOptions,
  createCompanyForOrganization,
  DEFAULT_ORGANIZATION_ID,
  getActiveCompanyContext,
  userCanManageOrganization,
} from "@/lib/server/company-context";

/**
 * GET /api/companies
 * Companies available to the signed-in user.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const context = await getActiveCompanyContext(user.user_id);
  return NextResponse.json({
    active_company_id: context.company.id,
    organization: context.organization,
    data: context.companies,
  });
}

/**
 * POST /api/companies
 * Body: { name: string, switch_to?: boolean }
 * Creates a company under the active organization and adds the creator as admin.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage =
    (await userCanManageOrganization(user.user_id)) ||
    user.role_id === "super_admin" ||
    user.role_id === "org_owner" ||
    user.role_id === "admin";
  if (!canManage) {
    return NextResponse.json({ error: "Only organization admins can create companies" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string; switch_to?: boolean } | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const context = await getActiveCompanyContext(user.user_id);
    const organizationId = context.organization?.id || DEFAULT_ORGANIZATION_ID;
    const company = await createCompanyForOrganization({
      name,
      organizationId,
      creatorUserId: user.user_id,
      creatorRole: user.role_id || "admin",
      requirePayment: organizationId !== DEFAULT_ORGANIZATION_ID,
    });

    const response = NextResponse.json({ ok: true, data: company }, { status: 201 });
    if (body?.switch_to !== false) {
      response.cookies.set(activeCompanyCookieName, company.id, activeCompanyCookieOptions());
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create company" },
      { status: 400 },
    );
  }
}
