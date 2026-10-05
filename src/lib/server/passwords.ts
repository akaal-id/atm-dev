import "server-only";

import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

import { hasPermission } from "@/lib/permissions";
import type { CurrentUser, User } from "@/lib/types";

/** No 0/O/1/l/I, so it can be read out loud or typed from a screenshot. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** e.g. "xK7m-pQ2r-W9bt": 12 random characters (~70 bits). */
export function generateTemporaryPassword() {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((part) => part.join("")).join("-");
}

export const MIN_PASSWORD_LENGTH = 8;

/** Returns an error message, or null when the password is acceptable. */
export function validateNewPassword(password: string, email = "") {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 128) return "Use at most 128 characters.";
  if (/^(.)\1+$/.test(password)) return "Don't repeat a single character.";
  if (email && password.toLowerCase() === email.toLowerCase()) return "Don't use your email as the password.";
  return null;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);

/** OAuth accounts store "oauth:<provider>" instead of a hash — they sign in with Google/Apple. */
export const isPasswordAccount = (user: Pick<User, "password_hash_or_auth_id">) => !String(user.password_hash_or_auth_id ?? "").startsWith("oauth:");

const PRIVILEGED_ROLES = new Set(["super_admin", "org_owner"]);

/** Admins with employees:manage may reset others; only owners/super admins may reset owners/super admins. */
export function resetPermissionError(actor: Pick<CurrentUser, "user_id" | "role_id">, target: Pick<User, "user_id" | "role_id">) {
  if (!hasPermission(actor.role_id, "employees:manage")) return "You don't have permission to reset passwords.";
  if (actor.user_id === target.user_id) return "Use Change password for your own account.";
  if (PRIVILEGED_ROLES.has(target.role_id) && !PRIVILEGED_ROLES.has(actor.role_id)) return "Only an owner or super admin can reset this account.";
  return null;
}

/**
 * A session issued before the last password change is no longer valid (reset = log out everywhere).
 * One second of slack: JWT `iat` has second precision.
 */
export function sessionPredatesPasswordChange(issuedAtSeconds: number | undefined, passwordChangedAt: string | null | undefined) {
  if (!issuedAtSeconds || !passwordChangedAt) return false;
  const changed = Date.parse(passwordChangedAt);
  return Number.isFinite(changed) && issuedAtSeconds * 1000 + 1000 < changed;
}
