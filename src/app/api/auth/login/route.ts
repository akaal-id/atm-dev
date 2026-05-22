import { NextResponse, type NextRequest } from "next/server";

import { authenticateUser, createSessionToken, sessionCookieName } from "@/lib/server/auth";

function safeNext(value: unknown) {
  const next = typeof value === "string" && value.startsWith("/") ? value : "/dashboard";
  return next.startsWith("//") ? "/dashboard" : next;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await request.json()) as Record<string, string>)
    : Object.fromEntries((await request.formData()).entries());

  const email = String(payload.email ?? "");
  const password = String(payload.password ?? "");
  const next = safeNext(payload.next);
  const user = await authenticateUser(email, password);

  if (!user) {
    if (contentType.includes("application/json")) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    return NextResponse.redirect(new URL(`/login?error=credentials&next=${encodeURIComponent(next)}`, request.url));
  }

  const token = await createSessionToken({ userId: user.user_id, email: user.email, roleId: user.role_id });
  const response = contentType.includes("application/json") ? NextResponse.json({ ok: true, next }) : NextResponse.redirect(new URL(next, request.url));

  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
