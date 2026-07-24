import "server-only";

import { createSignupRequest } from "@/lib/server/account-requests";
import { createOrgOwnerSignup } from "@/lib/server/org-signup";
import { uploadFormFile } from "@/lib/server/uploads";
import type { SignupAccountType } from "@/lib/types";

export interface ParsedSignupForm {
  account_type: SignupAccountType;
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  organization_id: string;
  company_id: string;
  department_id: string;
  birthday: string;
  join_date: string;
  phone: string;
  profile_photo: string;
  bio: string;
  organization_name: string;
  company_name: string;
}

export function parseSignupPayload(payload: Record<string, unknown>): ParsedSignupForm {
  const accountType = String(payload.account_type ?? "employee").trim();
  return {
    account_type: accountType === "org_owner" ? "org_owner" : "employee",
    full_name: String(payload.full_name ?? "").trim(),
    email: String(payload.email ?? "").trim().toLowerCase(),
    password: String(payload.password ?? ""),
    confirm_password: String(payload.confirm_password ?? ""),
    organization_id: String(payload.organization_id ?? "").trim(),
    company_id: String(payload.company_id ?? "").trim(),
    department_id: String(payload.department_id ?? "").trim(),
    birthday: String(payload.birthday ?? "").trim(),
    join_date: String(payload.join_date ?? "").trim(),
    phone: String(payload.phone ?? "").trim(),
    profile_photo: String(payload.profile_photo ?? "").trim(),
    bio: String(payload.bio ?? "").trim(),
    organization_name: String(payload.organization_name ?? "").trim(),
    company_name: String(payload.company_name ?? "").trim(),
  };
}

export async function parseSignupFormData(formData: FormData): Promise<ParsedSignupForm> {
  const profilePhotoFile = formData.get("profile_photo_file");
  let profile_photo = String(formData.get("profile_photo") ?? "").trim();

  if (typeof File !== "undefined" && profilePhotoFile instanceof File && profilePhotoFile.size > 0) {
    profile_photo = await uploadFormFile(profilePhotoFile, "profile_photo_file");
  }

  return parseSignupPayload({
    account_type: formData.get("account_type"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
    organization_id: formData.get("organization_id"),
    company_id: formData.get("company_id"),
    department_id: formData.get("department_id"),
    birthday: formData.get("birthday"),
    join_date: formData.get("join_date"),
    phone: formData.get("phone"),
    profile_photo,
    bio: formData.get("bio"),
    organization_name: formData.get("organization_name"),
    company_name: formData.get("company_name"),
  });
}

export function isValidSignupForm(input: ParsedSignupForm) {
  if (!input.full_name || !input.email || !input.password || input.password.length < 8) return false;
  if (input.password !== input.confirm_password) return false;

  if (input.account_type === "org_owner") {
    return Boolean(input.organization_name);
  }

  return Boolean(input.organization_id && input.company_id && input.department_id && input.birthday && input.join_date);
}

export function toSignupRequestInput(input: ParsedSignupForm) {
  return {
    full_name: input.full_name,
    email: input.email,
    password: input.password,
    organization_id: input.organization_id,
    company_id: input.company_id,
    department_id: input.department_id,
    birthday: input.birthday,
    join_date: input.join_date,
    phone: input.phone,
    profile_photo: input.profile_photo,
    bio: input.bio,
    signup_provider: "password",
  };
}

export function signupValidationError(input: ParsedSignupForm) {
  if (!input.full_name || !input.email) return "missing";

  if (input.account_type === "org_owner") {
    if (!input.organization_name) return "missing";
  } else if (!input.organization_id || !input.company_id || !input.department_id || !input.birthday || !input.join_date) {
    return "missing";
  }

  if (!input.password || input.password.length < 8) return "password";
  if (input.password !== input.confirm_password) return "mismatch";

  return null;
}

export async function resolveSignupRedirectPath(input: ParsedSignupForm) {
  const base = input.account_type === "org_owner" ? "/signup/organization" : "/signup";
  const validationError = signupValidationError(input);
  if (validationError) {
    return `${base}?error=${validationError}`;
  }

  if (input.account_type === "org_owner") {
    const result = await createOrgOwnerSignup({
      full_name: input.full_name,
      email: input.email,
      password: input.password,
      phone: input.phone,
      profile_photo: input.profile_photo,
      bio: input.bio,
      birthday: input.birthday,
      organization_name: input.organization_name,
      company_name: input.company_name || input.organization_name,
    });

    if (!result.ok && result.reason === "active_exists") {
      return `${base}?error=exists`;
    }

    return "/signup/requested?type=org_owner";
  }

  const result = await createSignupRequest(toSignupRequestInput(input));

  if (!result.ok && result.reason === "active_exists") {
    return `${base}?error=exists`;
  }

  return "/signup/requested";
}
