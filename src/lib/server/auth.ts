import "server-only";

import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cache } from "react";

import { departments as seedDepartments, roles as seedRoles } from "@/lib/data/seed";
import { hasPermission } from "@/lib/permissions";
import { authOptions } from "@/lib/server/next-auth-options";
import { listResourceByFieldUnscoped } from "@/lib/server/store";
import type { CurrentUser, Permission, RoleKey, User } from "@/lib/types";

export const sessionCookieName = "atm_session";

interface SessionPayload {
  userId: string;
  email: string;
  roleId: RoleKey;
}

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return new TextEncoder().encode("replace-this-with-a-long-random-auth-secret-before-production");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (!payload.userId || !payload.email || !payload.roleId) return null;

    return {
      userId: String(payload.userId),
      email: String(payload.email),
      roleId: payload.roleId as RoleKey,
    };
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const cookieSession = token ? await verifySessionToken(token) : null;
  if (cookieSession) return cookieSession;

  const nextAuthSession = await getServerSession(authOptions);
  const email = nextAuthSession?.user?.email;
  if (!email) return null;

  // Identity lookups must ignore active company — otherwise a switched company cookie
  // can hide the session user and cause login↔dashboard redirect loops.
  const users = await listResourceByFieldUnscoped("Users", "email", email.toLowerCase(), { limit: 1 });
  const user = users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase() && candidate.is_active) as User | undefined;
  if (!user) return null;

  return {
    userId: user.user_id,
    email: user.email,
    roleId: user.role_id,
  };
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.toLowerCase();
  const users = await listResourceByFieldUnscoped("Users", "email", normalizedEmail, { limit: 1 });
  const user = users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail && candidate.is_active) as User | undefined;

  if (!user) return null;

  const passwordMatches = await bcrypt.compare(password, user.password_hash_or_auth_id);
  if (!passwordMatches) return null;

  return user;
}

export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  const users = await listResourceByFieldUnscoped("Users", "user_id", session.userId, { limit: 1 });
  const user = users.find((candidate) => candidate.user_id === session.userId && candidate.is_active);
  if (!user) return null;

  const [roles, departments] = await Promise.all([
    listResourceByFieldUnscoped("Roles", "role_id", user.role_id, { limit: 1 }),
    listResourceByFieldUnscoped("Departments", "department_id", user.department_id, { limit: 1 }),
  ]);
  const role = roles[0] ?? seedRoles[seedRoles.length - 1];
  const department = departments[0] ?? seedDepartments[0];
  const { password_hash_or_auth_id: passwordHash, ...safeUser } = user;
  void passwordHash;

  return {
    ...safeUser,
    role,
    department,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user as CurrentUser;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.role_id, permission)) redirect("/dashboard");
  return user as CurrentUser;
}
