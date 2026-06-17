import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = "atm_session";

const protectedPrefixes = [
  "/dashboard",
  "/tasks",
  "/projects",
  "/calendar",
  "/attendance",
  "/announcements",
  "/employees",
  "/leaderboard",
  "/notifications",
  "/chat",
  "/admin",
  "/invite",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);

  if (pathname === "/" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/" && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (protectedPrefixes.some((prefix) => pathname.startsWith(prefix)) && !hasSession) {
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
    "/employees/:path*",
    "/leaderboard/:path*",
    "/notifications/:path*",
    "/chat/:path*",
    "/admin/:path*",
    "/invite",
    "/login",
  ],
};
