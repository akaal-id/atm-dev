import { NextResponse, type NextRequest } from "next/server";

import { isProtectedPath, safeNextPath } from "@/lib/auth-routes";

const sessionCookieName = "atm_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);

  if (pathname === "/" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/login" && hasSession) {
    const destination = safeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (isProtectedPath(pathname) && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/tasks/:path*",
    "/projects/:path*",
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
  ],
};
