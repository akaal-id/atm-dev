import { NextResponse, type NextRequest } from "next/server";

import { sessionCookieName } from "@/lib/server/auth";
import { activeCompanyCookieName, activeOrganizationCookieName } from "@/lib/tenant-path";

/** Cookies that must die on sign-out: own session, next-auth fallback session, tenant scope. */
const clearedCookies = [
  sessionCookieName,
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  activeCompanyCookieName,
  activeOrganizationCookieName,
];

export async function POST(request: NextRequest) {
  // 303, not the default 307: a 307 makes the browser re-POST to /login (a page → 404).
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  for (const name of clearedCookies) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
