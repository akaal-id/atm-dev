import { NextResponse, type NextRequest } from "next/server";

import { completePasswordReset } from "@/lib/server/password-reset";

/** Finishes a reset from the emailed link: sets the new password and signs out every session. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: string; newPassword?: string } | null;
  const error = await completePasswordReset(String(body?.token ?? ""), String(body?.newPassword ?? ""));
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ data: { ok: true } });
}
