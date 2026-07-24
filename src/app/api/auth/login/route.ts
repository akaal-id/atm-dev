import { NextResponse, type NextRequest } from "next/server";

import { authenticateUser, createSessionToken, sessionCookieName } from "@/lib/server/auth";
import {
  activeCompanyCookieName,
  activeCompanyCookieOptions,
  DEFAULT_COMPANY_ID,
  DEFAULT_ORGANIZATION_ID,
  getActiveCompanyContext,
} from "@/lib/server/company-context";
import {
  activeOrganizationCookieName,
  buildTenantPath,
  isTenantPath,
} from "@/lib/tenant-path";

function resolveNext(value: unknown, tenant: { orgId: string; companyId: string }) {
  const raw = typeof value === "string" ? value : "";
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    if (isTenantPath(raw)) return raw;
    if (raw === "/billing" || raw.startsWith("/login") || raw.startsWith("/signup") || raw.startsWith("/verify")) {
      return raw;
    }
    // Legacy workspace path → tenant URL
    if (raw === "/dashboard" || raw.startsWith("/tasks") || raw.startsWith("/employees") || raw.startsWith("/admin") || raw.startsWith("/chat") || raw.startsWith("/projects") || raw.startsWith("/calendar") || raw.startsWith("/attendance") || raw.startsWith("/announcements") || raw.startsWith("/email-blast") || raw.startsWith("/leaderboard") || raw.startsWith("/notifications") || raw.startsWith("/project-files")) {
      return buildTenantPath({ ...tenant, path: raw });
    }
    return raw;
  }
  return buildTenantPath({ ...tenant, path: "/dashboard" });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await request.json()) as Record<string, string>)
    : Object.fromEntries((await request.formData()).entries());

  const email = String(payload.email ?? "");
  const password = String(payload.password ?? "");
  const user = await authenticateUser(email, password);

  let tenant = { orgId: DEFAULT_ORGANIZATION_ID, companyId: DEFAULT_COMPANY_ID };
  if (user) {
    try {
      const context = await getActiveCompanyContext(user.user_id);
      tenant = {
        orgId: context.organization?.id || context.company.organization_id || DEFAULT_ORGANIZATION_ID,
        companyId: context.company.id || DEFAULT_COMPANY_ID,
      };
    } catch {
      // keep defaults
    }
  }

  const next = resolveNext(payload.next, tenant);

  if (!user) {
    if (contentType.includes("application/json")) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    return NextResponse.redirect(new URL(`/login?error=credentials&next=${encodeURIComponent(next)}`, request.url));
  }

  const token = await createSessionToken({ userId: user.user_id, email: user.email, roleId: user.role_id });
  const response = contentType.includes("application/json")
    ? NextResponse.json({ ok: true, next })
    : NextResponse.redirect(new URL(next, request.url));

  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  response.cookies.set(activeCompanyCookieName, tenant.companyId, activeCompanyCookieOptions());
  response.cookies.set(activeOrganizationCookieName, tenant.orgId, activeCompanyCookieOptions());

  return response;
}
