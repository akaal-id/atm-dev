import "server-only";

import { randomInt } from "node:crypto";

import bcrypt from "bcryptjs";

import { createResource, listResource, updateResource } from "@/lib/server/store";
import { sendEmail } from "@/lib/server/resend";
import type { User } from "@/lib/types";

interface SignupRequestInput {
  full_name: string;
  email: string;
  password?: string;
  department_id?: string;
  birthday?: string;
  join_date?: string;
  phone?: string;
  profile_photo?: string;
  bio?: string;
  signup_provider?: string;
}

interface AdminActor {
  user_id: string;
  full_name: string;
}

function appUrl(path = "") {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return new URL(path, baseUrl).toString();
}

function onboardingFromEmail() {
  return process.env.RESEND_ONBOARDING_FROM_EMAIL || "Akaal Team Management <onboarding@akaal.id>";
}

function verificationCode() {
  return String(randomInt(100000, 1000000));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isPendingUser(user: User) {
  return user.signup_status === "pending" || user.signup_status === "approved";
}

export async function createSignupRequest(input: SignupRequestInput) {
  const users = await listResource("Users");
  const existing = users.find((user) => user.email.toLowerCase() === input.email.toLowerCase()) as User | undefined;

  if (existing?.is_active) {
    return { ok: false, reason: "active_exists" as const };
  }

  if (existing && isPendingUser(existing)) {
    return { ok: true, user: existing, alreadyPending: true };
  }

  const now = new Date().toISOString();
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : `oauth:${input.signup_provider ?? "unknown"}`;

  if (existing) {
    const updated = await updateResource("Users", existing.user_id, {
      full_name: input.full_name,
      password_hash_or_auth_id: passwordHash,
      profile_photo: input.profile_photo ?? existing.profile_photo ?? "",
      bio: input.bio ?? existing.bio ?? "",
      phone: input.phone ?? existing.phone ?? "",
      department_id: input.department_id ?? existing.department_id ?? "",
      birthday: input.birthday ?? existing.birthday ?? "",
      join_date: input.join_date ?? existing.join_date ?? "",
      position: "Pending access",
      employment_status: "Inactive",
      role_id: "employee",
      is_active: false,
      signup_status: "pending",
      signup_provider: input.signup_provider ?? "password",
      verification_key_hash: "",
      verification_expires_at: "",
      requested_at: now,
      approved_at: "",
      rejected_at: "",
      rejection_reason: "",
      updated_at: now,
    });
    const user = { ...existing, ...(updated as User) };

    await sendRequestReceivedEmail(user);
    await notifyAdminsAboutRequest(user);

    return { ok: true, user, alreadyPending: false };
  }

  const user = await createResource("Users", {
    full_name: input.full_name,
    email: input.email,
    password_hash_or_auth_id: passwordHash,
    profile_photo: input.profile_photo ?? "",
    bio: input.bio ?? "",
    phone: input.phone ?? "",
    department_id: input.department_id ?? "",
    position: "Pending access",
    employment_status: "Inactive",
    role_id: "employee",
    birthday: input.birthday ?? "",
    join_date: input.join_date ?? "",
    is_active: false,
    signup_status: "pending",
    signup_provider: input.signup_provider ?? "password",
    verification_key_hash: "",
    verification_expires_at: "",
    requested_at: now,
    approved_at: "",
    rejected_at: "",
    rejection_reason: "",
  });

  await sendRequestReceivedEmail(user as User);
  await notifyAdminsAboutRequest(user as User);

  return { ok: true, user: user as User, alreadyPending: false };
}

export async function approveSignupRequest(userId: string, adminUser: AdminActor) {
  const users = await listResource("Users");
  const user = users.find((candidate) => candidate.user_id === userId) as User | undefined;
  if (!user) return { ok: false, reason: "not_found" as const };

  const key = verificationCode();
  const keyHash = await bcrypt.hash(key, 10);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const approvedAt = new Date().toISOString();

  const updated = await updateResource("Users", userId, {
    signup_status: "approved",
    verification_key_hash: keyHash,
    verification_expires_at: expiresAt,
    approved_at: approvedAt,
    rejected_at: "",
    rejection_reason: "",
    updated_at: approvedAt,
  });

  await sendVerificationKeyEmail({ ...user, ...(updated as User) }, key);
  await createResource("Activity_Logs", {
    user_id: adminUser.user_id,
    action: "approved",
    entity_type: "Users",
    entity_id: userId,
    description: `${adminUser.full_name} approved account access for ${user.full_name}.`,
    created_at: approvedAt,
  });

  return { ok: true };
}

export async function rejectSignupRequest(userId: string, adminUser: AdminActor, reason: string) {
  const users = await listResource("Users");
  const user = users.find((candidate) => candidate.user_id === userId) as User | undefined;
  if (!user) return { ok: false, reason: "not_found" as const };

  const rejectedAt = new Date().toISOString();
  await updateResource("Users", userId, {
    signup_status: "rejected",
    is_active: false,
    rejected_at: rejectedAt,
    rejection_reason: reason,
    updated_at: rejectedAt,
  });

  await sendRejectedEmail(user, reason);
  await createResource("Activity_Logs", {
    user_id: adminUser.user_id,
    action: "rejected",
    entity_type: "Users",
    entity_id: userId,
    description: `${adminUser.full_name} rejected account access for ${user.full_name}.`,
    created_at: rejectedAt,
  });

  return { ok: true };
}

export async function verifySignupKey(email: string, key: string) {
  const users = await listResource("Users");
  const user = users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase() && candidate.signup_status === "approved") as User | undefined;

  if (!user || user.signup_status !== "approved" || !user.verification_key_hash) {
    return { ok: false, reason: "invalid" as const };
  }

  if (user.verification_expires_at && new Date(user.verification_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" as const };
  }

  const matches = await bcrypt.compare(key, user.verification_key_hash);
  if (!matches) return { ok: false, reason: "invalid" as const };

  const now = new Date().toISOString();
  await updateResource("Users", user.user_id, {
    is_active: true,
    position: user.position && user.position !== "Pending access" ? user.position : "Team Member",
    employment_status: user.employment_status && user.employment_status !== "Inactive" ? user.employment_status : "Employee",
    signup_status: "verified",
    verification_key_hash: "",
    verification_expires_at: "",
    join_date: user.join_date || now.slice(0, 10),
    updated_at: now,
  });

  return { ok: true };
}

async function sendRequestReceivedEmail(user: User) {
  const name = escapeHtml(user.full_name);

  await sendEmail({
    to: user.email,
    from: onboardingFromEmail(),
    subject: "Your ATM account request was received",
    html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a"><h1 style="font-size:20px">Akaal Team Management</h1><p>Hi ${name}, your account request has been sent to the admin team.</p><p>You will receive a verification key after an admin approves your request.</p></div>`,
    text: `Hi ${user.full_name}, your ATM account request has been sent to the admin team. You will receive a verification key after an admin approves your request.`,
  });
}

async function sendVerificationKeyEmail(user: User, key: string) {
  const name = escapeHtml(user.full_name);
  const verifyUrl = escapeHtml(appUrl("/verify"));

  await sendEmail({
    to: user.email,
    from: onboardingFromEmail(),
    subject: "Your ATM verification key",
    html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a"><h1 style="font-size:20px">Akaal Team Management</h1><p>Hi ${name}, your account request was approved.</p><p style="font-size:24px;font-weight:800;letter-spacing:0.18em">${key}</p><p>Submit this key to activate your account.</p><p><a href="${verifyUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">Verify account</a></p></div>`,
    text: `Hi ${user.full_name}, your ATM account request was approved. Verification key: ${key}. Verify here: ${appUrl("/verify")}`,
  });
}

async function sendRejectedEmail(user: User, reason: string) {
  const name = escapeHtml(user.full_name);
  const safeReason = escapeHtml(reason || "Please contact your team admin for details.");

  await sendEmail({
    to: user.email,
    from: onboardingFromEmail(),
    subject: "Your ATM account request was not approved",
    html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a"><h1 style="font-size:20px">Akaal Team Management</h1><p>Hi ${name}, your account request was not approved.</p><p>${safeReason}</p></div>`,
    text: `Hi ${user.full_name}, your ATM account request was not approved. ${reason || "Please contact your team admin for details."}`,
  });
}

async function notifyAdminsAboutRequest(user: User) {
  const users = await listResource("Users");
  const admins = users.filter((candidate) => candidate.is_active && ["super_admin", "admin"].includes(candidate.role_id));

  await Promise.all(
    admins.map((admin) =>
      createResource("Notifications", {
        user_id: admin.user_id,
        title: "New account request",
        description: `${user.full_name} requested access to ATM.`,
        type: "account_request",
        related_link: "/admin",
        is_read: false,
        created_at: new Date().toISOString(),
      }),
    ),
  );
}
