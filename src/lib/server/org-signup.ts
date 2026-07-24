import "server-only";

import bcrypt from "bcryptjs";

import { createOrganizationWithOwner } from "@/lib/server/company-context";
import { createResource, listResourceByFieldUnscoped, updateResource } from "@/lib/server/store";
import type { User } from "@/lib/types";

export interface OrgOwnerSignupInput {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  profile_photo?: string;
  bio?: string;
  birthday?: string;
  organization_name: string;
  company_name: string;
}

/**
 * Self-serve org owner onboarding:
 * create verified user → organization → first company (pending payment / unverified).
 */
export async function createOrgOwnerSignup(input: OrgOwnerSignupInput) {
  const email = input.email.trim().toLowerCase();
  const existing = (
    await listResourceByFieldUnscoped("Users", "email", email, { limit: 1 })
  )[0] as User | undefined;

  if (existing?.is_active) {
    return { ok: false as const, reason: "active_exists" as const };
  }

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const organizationName = input.organization_name.trim();
  const companyName = input.company_name.trim() || organizationName;

  let user: User;
  if (existing) {
    const updated = await updateResource("Users", existing.user_id, {
      full_name: input.full_name.trim(),
      password_hash_or_auth_id: passwordHash,
      profile_photo: input.profile_photo ?? "",
      bio: input.bio ?? "",
      phone: input.phone ?? "",
      department_id: "",
      birthday: input.birthday ?? "",
      join_date: now.slice(0, 10),
      position: "Organization Owner",
      employment_status: "Admin",
      role_id: "org_owner",
      is_active: true,
      signup_status: "verified",
      signup_provider: "password",
      verification_key_hash: "",
      verification_expires_at: "",
      requested_at: now,
      approved_at: now,
      rejected_at: "",
      rejection_reason: "",
      updated_at: now,
    });
    user = { ...existing, ...(updated as User) };
  } else {
    user = (await createResource("Users", {
      full_name: input.full_name.trim(),
      email,
      password_hash_or_auth_id: passwordHash,
      profile_photo: input.profile_photo ?? "",
      bio: input.bio ?? "",
      phone: input.phone ?? "",
      department_id: "",
      position: "Organization Owner",
      employment_status: "Admin",
      role_id: "org_owner",
      birthday: input.birthday ?? "",
      join_date: now.slice(0, 10),
      is_active: true,
      signup_status: "verified",
      signup_provider: "password",
      verification_key_hash: "",
      verification_expires_at: "",
      requested_at: now,
      approved_at: now,
      rejected_at: "",
      rejection_reason: "",
    })) as User;
  }

  const { organization, company } = await createOrganizationWithOwner({
    organizationName,
    companyName,
    ownerUserId: user.user_id,
    ownerEmail: email,
    ownerPhone: input.phone,
  });

  await updateResource("Users", user.user_id, {
    company_id: company.id,
    updated_at: now,
  });

  return {
    ok: true as const,
    user: { ...user, company_id: company.id },
    organization,
    company,
  };
}
