import "server-only";

import { createSignupRequest } from "@/lib/server/account-requests";
import { uploadFormFile } from "@/lib/server/uploads";

export interface ParsedSignupForm {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  department_id: string;
  birthday: string;
  join_date: string;
  phone: string;
  profile_photo: string;
  bio: string;
}

export function parseSignupPayload(payload: Record<string, unknown>): ParsedSignupForm {
  return {
    full_name: String(payload.full_name ?? "").trim(),
    email: String(payload.email ?? "").trim().toLowerCase(),
    password: String(payload.password ?? ""),
    confirm_password: String(payload.confirm_password ?? ""),
    department_id: String(payload.department_id ?? "").trim(),
    birthday: String(payload.birthday ?? "").trim(),
    join_date: String(payload.join_date ?? "").trim(),
    phone: String(payload.phone ?? "").trim(),
    profile_photo: String(payload.profile_photo ?? "").trim(),
    bio: String(payload.bio ?? "").trim(),
  };
}

export async function parseSignupFormData(formData: FormData): Promise<ParsedSignupForm> {
  const profilePhotoFile = formData.get("profile_photo_file");
  let profile_photo = String(formData.get("profile_photo") ?? "").trim();

  if (typeof File !== "undefined" && profilePhotoFile instanceof File && profilePhotoFile.size > 0) {
    profile_photo = await uploadFormFile(profilePhotoFile, "profile_photo_file");
  }

  return parseSignupPayload({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
    department_id: formData.get("department_id"),
    birthday: formData.get("birthday"),
    join_date: formData.get("join_date"),
    phone: formData.get("phone"),
    profile_photo,
    bio: formData.get("bio"),
  });
}

export function isValidSignupForm(input: ParsedSignupForm) {
  return Boolean(
    input.full_name &&
      input.email &&
      input.password &&
      input.password.length >= 8 &&
      input.password === input.confirm_password &&
      input.department_id &&
      input.birthday &&
      input.join_date,
  );
}

export function toSignupRequestInput(input: ParsedSignupForm) {
  return {
    full_name: input.full_name,
    email: input.email,
    password: input.password,
    department_id: input.department_id,
    birthday: input.birthday,
    join_date: input.join_date,
    phone: input.phone,
    profile_photo: input.profile_photo,
    bio: input.bio,
    signup_provider: "password",
  };
}

export async function resolveSignupRedirectPath(input: ParsedSignupForm) {
  if (!isValidSignupForm(input)) {
    return "/signup?error=invalid";
  }

  const result = await createSignupRequest(toSignupRequestInput(input));

  if (!result.ok && result.reason === "active_exists") {
    return "/signup?error=exists";
  }

  return "/signup/requested";
}
