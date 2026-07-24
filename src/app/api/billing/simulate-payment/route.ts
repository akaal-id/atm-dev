import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import {
  companyHasErpAccess,
  getActiveCompanyContext,
  simulateCompanyPayment,
  userCanAccessCompany,
} from "@/lib/server/company-context";

/**
 * POST /api/billing/simulate-payment
 * Dummy paywall — marks the active (or requested) company as verified/active.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { company_id?: string } | null;
  const context = await getActiveCompanyContext(user.user_id);
  const companyId = String(body?.company_id ?? context.company.id).trim();

  if (user.role_id !== "super_admin") {
    const allowed =
      context.companies.some((company) => company.id === companyId) ||
      (await userCanAccessCompany(user.user_id, companyId));
    if (!allowed) {
      return NextResponse.json({ error: "You do not have access to this company" }, { status: 403 });
    }
  }

  try {
    const company = await simulateCompanyPayment(companyId, user.user_id);
    return NextResponse.json({
      ok: true,
      data: company,
      has_erp_access: companyHasErpAccess(company),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment simulation failed" },
      { status: 400 },
    );
  }
}
