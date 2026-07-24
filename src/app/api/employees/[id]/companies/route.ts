import { NextResponse, type NextRequest } from "next/server";

import { requireApiPermission } from "@/lib/server/api";
import {
  addEmployeeToCompany,
  listEmployeeCompanies,
  removeEmployeeFromCompany,
} from "@/lib/server/company-context";
import { getResourceById } from "@/lib/server/store";

type RouteContext = { params: Promise<{ id: string }> };

async function requireEmployee(id: string) {
  const employee = await getResourceById("Users", id);
  if (!employee) return { error: NextResponse.json({ error: "Employee not found" }, { status: 404 }) };
  return { employee };
}

/**
 * GET /api/employees/:id/companies
 * List company memberships for an employee.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const access = await requireApiPermission("employees:view");
  if (access.error) return access.error;

  const { id } = await context.params;
  const found = await requireEmployee(id);
  if (found.error) return found.error;

  const data = await listEmployeeCompanies(id);
  return NextResponse.json({ employee_id: id, count: data.length, data });
}

/**
 * POST /api/employees/:id/companies
 * Body: { company_id: string, role?: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireApiPermission("employees:manage");
  if (access.error) return access.error;

  const { id } = await context.params;
  const found = await requireEmployee(id);
  if (found.error) return found.error;

  const body = (await request.json().catch(() => null)) as { company_id?: string; role?: string } | null;
  const companyId = String(body?.company_id ?? "").trim();
  if (!companyId) return NextResponse.json({ error: "company_id is required" }, { status: 400 });

  try {
    const membership = await addEmployeeToCompany({
      userId: id,
      companyId,
      role: body?.role,
    });
    return NextResponse.json({ ok: true, data: membership }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add company access" },
      { status: 400 },
    );
  }
}

/**
 * DELETE /api/employees/:id/companies
 * Body or query: company_id
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireApiPermission("employees:manage");
  if (access.error) return access.error;

  const { id } = await context.params;
  const found = await requireEmployee(id);
  if (found.error) return found.error;

  const urlCompanyId = request.nextUrl.searchParams.get("company_id");
  const body = (await request.json().catch(() => null)) as { company_id?: string } | null;
  const companyId = String(body?.company_id ?? urlCompanyId ?? "").trim();
  if (!companyId) return NextResponse.json({ error: "company_id is required" }, { status: 400 });

  await removeEmployeeFromCompany(id, companyId);
  return NextResponse.json({ ok: true });
}
