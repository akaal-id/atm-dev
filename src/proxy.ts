import { NextResponse, type NextRequest } from "next/server";

import {
  isLegacyWorkspacePath,
  isProtectedPath,
  safeNextPath,
  tenantFromRequestCookies,
} from "@/lib/auth-routes";
import {
  activeCompanyCookieName,
  activeOrganizationCookieName,
  buildTenantPath,
  companyIdToCookie,
  isTenantPath,
  parseTenantPath,
} from "@/lib/tenant-path";

const sessionCookieName = "atm_session";

function cookieOptions(maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);

  if (pathname === "/" && hasSession) {
    const tenant = tenantFromRequestCookies(request.cookies);
    return NextResponse.redirect(new URL(buildTenantPath({ ...tenant, path: "/dashboard" }), request.url));
  }

  if (pathname === "/login" && hasSession) {
    const requested = safeNextPath(request.nextUrl.searchParams.get("next"));
    const destination = isTenantPath(requested)
      ? requested
      : isLegacyWorkspacePath(requested) || requested === "/dashboard"
        ? buildTenantPath({ ...tenantFromRequestCookies(request.cookies), path: requested })
        : requested;
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (isProtectedPath(pathname) && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/billing" && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/billing");
    return NextResponse.redirect(login);
  }

  // Tenant URL → set cookies + rewrite to legacy workspace path
  if (hasSession && isTenantPath(pathname)) {
    const parsed = parseTenantPath(pathname);
    if (!parsed) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = parsed.rest;
    const response = NextResponse.rewrite(url);
    response.cookies.set(activeCompanyCookieName, companyIdToCookie(parsed.companyId), cookieOptions());
    response.cookies.set(activeOrganizationCookieName, parsed.orgId, cookieOptions());
    return response;
  }

  // Legacy workspace URL → redirect into tenant URL (document navigations only).
  // RSC/flight requests must not bounce here — that can loop with the tenant rewrite above.
  if (hasSession && isLegacyWorkspacePath(pathname)) {
    const isFlight =
      request.headers.get("rsc") === "1" ||
      request.headers.get("next-router-state-tree") != null ||
      request.headers.get("next-router-prefetch") != null;
    if (isFlight) return NextResponse.next();

    const tenant = tenantFromRequestCookies(request.cookies);
    const destination = buildTenantPath({ ...tenant, path: pathname });
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/org/:path*",
    "/dashboard/:path*",
    "/tasks/:path*",
    "/projects/:path*",
    "/workflows/:path*",
    "/project-files/:path*",
    "/calendar/:path*",
    "/attendance/:path*",
    "/announcements/:path*",
    "/email-blast/:path*",
    "/employees/:path*",
    "/leaderboard/:path*",
    "/notifications/:path*",
    "/chat/:path*",
    "/admin/:path*",
    "/invite",
    "/login",
    "/billing",
    "/tenant-access-denied",
  ],
};
