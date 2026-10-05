import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { hashPassword, isPasswordAccount, validateNewPassword } from "@/lib/server/passwords";
import { sendEmail } from "@/lib/server/resend";
import { updateResource } from "@/lib/server/store";
import { supabaseRest } from "@/lib/server/supabase-rest";

/*
 * "Forgot password": a one-time link by email. Only the SHA-256 of the token is stored,
 * links expire after an hour, work once, and at most 3 can be requested per account per hour.
 * The request endpoint answers the same way whether or not the email exists.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 3;

type UserRow = { user_id: string; email: string; full_name: string; is_active: boolean; password_hash_or_auth_id: string };
type TokenRow = { token_hash: string; user_id: string; expires_at: string; used_at: string | null };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

async function userByEmail(email: string) {
  const rows = await supabaseRest<UserRow[]>(
    `/users?select=user_id,email,full_name,is_active,password_hash_or_auth_id&email=eq.${encodeURIComponent(email.trim().toLowerCase())}&limit=1`,
  );
  return rows[0];
}

/** Sends the reset email when the account exists and can use a password. Never reveals which case happened. */
export async function requestPasswordReset(email: string, appUrl: string) {
  const user = await userByEmail(email);
  if (!user || !user.is_active || !isPasswordAccount(user)) return;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await supabaseRest<Array<{ token_hash: string }>>(
    `/password_reset_tokens?select=token_hash&user_id=eq.${encodeURIComponent(user.user_id)}&created_at=gte.${encodeURIComponent(since)}`,
  );
  if (recent.length >= MAX_PER_HOUR) return;

  const token = randomBytes(32).toString("base64url");
  await supabaseRest("/password_reset_tokens", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ token_hash: sha256(token), user_id: user.user_id, expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString() }),
  });

  const link = `${appUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
  const firstName = escapeHtml(user.full_name.split(" ")[0] || user.full_name);
  const result = await sendEmail({
    to: user.email,
    subject: "Reset your ATM password",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:480px">
        <h1 style="font-size:20px;margin:0 0 12px">Akaal Team Management</h1>
        <p style="margin:0 0 12px">Hi ${firstName},</p>
        <p style="margin:0 0 20px;color:#475569">Someone (hopefully you) asked to reset your ATM password. This link works once and expires in 1 hour.</p>
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Choose a new password</a>
        <p style="margin:20px 0 0;color:#64748b;font-size:13px">If you didn't ask for this, ignore this email — your password stays the same.</p>
      </div>
    `,
    text: `Hi ${user.full_name.split(" ")[0]},\n\nReset your ATM password (works once, expires in 1 hour):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
  });
  if (!result.ok) console.error("Password reset email failed", result.error);
}

async function liveToken(token: string) {
  if (!/^[A-Za-z0-9_-]{30,}$/.test(token)) return null;
  const [row] = await supabaseRest<TokenRow[]>(`/password_reset_tokens?select=token_hash,user_id,expires_at,used_at&token_hash=eq.${sha256(token)}&limit=1`);
  if (!row || row.used_at || Date.parse(row.expires_at) < Date.now()) return null;
  return row;
}

/** For the reset page: is this link still usable, and for whom? */
export async function checkResetToken(token: string) {
  const row = await liveToken(token);
  if (!row) return null;
  const [user] = await supabaseRest<Array<Pick<UserRow, "email" | "full_name" | "is_active">>>(`/users?select=email,full_name,is_active&user_id=eq.${encodeURIComponent(row.user_id)}&limit=1`);
  return user?.is_active ? { email: user.email, name: user.full_name } : null;
}

/** Sets the new password and burns every outstanding link for the account. Returns an error message or null. */
export async function completePasswordReset(token: string, newPassword: string) {
  const row = await liveToken(token);
  if (!row) return "This reset link is invalid or has expired. Request a new one.";
  const [user] = await supabaseRest<UserRow[]>(`/users?select=user_id,email,full_name,is_active,password_hash_or_auth_id&user_id=eq.${encodeURIComponent(row.user_id)}&limit=1`);
  if (!user?.is_active) return "This account is not active.";
  const invalid = validateNewPassword(newPassword, user.email);
  if (invalid) return invalid;

  const now = new Date().toISOString();
  // Burn the links first so a double-submit can't reuse them.
  await supabaseRest(`/password_reset_tokens?user_id=eq.${encodeURIComponent(user.user_id)}&used_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ used_at: now }),
  });
  await updateResource("Users", user.user_id, {
    password_hash_or_auth_id: await hashPassword(newPassword),
    must_change_password: false,
    password_changed_at: now,
  } as never);
  return null;
}
