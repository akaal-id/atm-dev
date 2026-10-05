import { NextResponse, type NextRequest } from "next/server";

import { requestPasswordReset } from "@/lib/server/password-reset";

/**
 * Starts a password reset. Always answers the same (and takes about as long), whether or not
 * the email belongs to an account, so the endpoint can't be used to discover accounts.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = String(body?.email ?? "").trim();
  const started = Date.now();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    // The configured app URL, never the request's Host header (which a caller could spoof into the email).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    await requestPasswordReset(email, appUrl).catch((error) => console.error("Password reset request failed", error));
  }
  const elapsed = Date.now() - started;
  if (elapsed < 800) await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
  return NextResponse.json({ data: { ok: true } });
}
