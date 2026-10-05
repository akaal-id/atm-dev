import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";

import { createSessionToken, getCurrentUser, sessionCookieName, sessionCookieOptions } from "@/lib/server/auth";
import { hashPassword, isPasswordAccount, validateNewPassword } from "@/lib/server/passwords";
import { listResourceByFieldUnscoped, updateResource } from "@/lib/server/store";
import type { User } from "@/lib/types";

/**
 * Change your own password. The current password is required, except right after an admin reset
 * (must_change_password), where signing in with the temporary password already proved it.
 * Other sessions are logged out; this one gets a fresh cookie.
 */
export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { currentPassword?: string; newPassword?: string } | null;
  const newPassword = String(body?.newPassword ?? "");
  const currentPassword = String(body?.currentPassword ?? "");

  const [user] = (await listResourceByFieldUnscoped("Users", "user_id", me.user_id, { limit: 1 })) as User[];
  if (!user || !isPasswordAccount(user)) {
    return NextResponse.json({ error: "This account signs in with Google/Apple and has no password." }, { status: 400 });
  }
  if (!user.must_change_password) {
    const ok = currentPassword ? await bcrypt.compare(currentPassword, user.password_hash_or_auth_id) : false;
    if (!ok) return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
  }
  const invalid = validateNewPassword(newPassword, user.email);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (await bcrypt.compare(newPassword, user.password_hash_or_auth_id)) {
    return NextResponse.json({ error: "Choose a password different from the current one." }, { status: 400 });
  }

  await updateResource("Users", user.user_id, {
    password_hash_or_auth_id: await hashPassword(newPassword),
    must_change_password: false,
    password_changed_at: new Date().toISOString(),
  } as never);

  // A fresh token for this device; sessions issued before password_changed_at are rejected.
  const token = await createSessionToken({ userId: user.user_id, email: user.email, roleId: user.role_id });
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(sessionCookieName, token, sessionCookieOptions());
  return response;
}
