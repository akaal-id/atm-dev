import { NextResponse, type NextRequest } from "next/server";

import { readPayload } from "@/lib/server/api";
import { verifySignupKey } from "@/lib/server/account-requests";

export async function POST(request: NextRequest) {
  const payload = await readPayload(request);
  const email = String(payload.email ?? "").trim().toLowerCase();
  const key = String(payload.verification_key ?? "").trim();

  if (!email || !key) {
    return NextResponse.redirect(new URL("/verify?error=invalid", request.url));
  }

  const result = await verifySignupKey(email, key);
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/verify?error=${result.reason}`, request.url));
  }

  return NextResponse.redirect(new URL("/login?verified=1", request.url));
}
