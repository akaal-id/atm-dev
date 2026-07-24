import { NextResponse, type NextRequest } from "next/server";

import { listResourceUnscoped } from "@/lib/server/store";
import type { Department } from "@/lib/types";

/**
 * GET /api/signup/departments?company_id=cmp_akaal
 * Public department list for employee signup (scoped to one company).
 */
export async function GET(request: NextRequest) {
  const companyId = String(request.nextUrl.searchParams.get("company_id") ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  try {
    const departments = (await listResourceUnscoped("Departments")) as Department[];
    const scoped = departments
      .filter((department) => String(department.company_id ?? "").trim() === companyId)
      .map((department) => ({
        department_id: department.department_id,
        department_name: department.department_name,
      }))
      .sort((left, right) => left.department_name.localeCompare(right.department_name));

    return NextResponse.json({ data: scoped });
  } catch (error) {
    console.error("signup departments lookup failed", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
