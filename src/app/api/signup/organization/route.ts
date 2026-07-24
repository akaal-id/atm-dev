import { NextResponse, type NextRequest } from "next/server";

import { lookupOrganizationForSignup } from "@/lib/server/company-context";
import { listResourceUnscoped } from "@/lib/server/store";
import type { Department } from "@/lib/types";

/**
 * GET /api/signup/organization?id=org_akaal|akaal
 * Public lookup for employee signup: organization + company list.
 */
export async function GET(request: NextRequest) {
  const id = String(request.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Organization id is required" }, { status: 400 });
  }

  try {
    const result = await lookupOrganizationForSignup(id);
    if (!result) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug ?? "",
      },
      companies: result.companies.map((company) => ({
        id: company.id,
        name: company.name,
        is_verified: Boolean(company.is_verified),
      })),
    });
  } catch (error) {
    console.error("signup organization lookup failed", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
