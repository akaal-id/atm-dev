import { NextResponse, type NextRequest } from "next/server";

import { readPayload } from "@/lib/server/api";
import { createSignupRequest } from "@/lib/server/account-requests";
import { UploadError } from "@/lib/server/uploads";

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await readPayload(request);
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.redirect(new URL("/signup?error=upload", request.url));
    }
    throw error;
  }

  const fullName = String(payload.full_name ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const confirmPassword = String(payload.confirm_password ?? "");
  const departmentId = String(payload.department_id ?? "").trim();
  const birthday = String(payload.birthday ?? "").trim();
  const joinDate = String(payload.join_date ?? "").trim();

  if (!fullName || !email || !password || password.length < 8 || password !== confirmPassword || !departmentId || !birthday || !joinDate) {
    return NextResponse.redirect(new URL("/signup?error=invalid", request.url));
  }

  const result = await createSignupRequest({
    full_name: fullName,
    email,
    password,
    department_id: departmentId,
    birthday,
    join_date: joinDate,
    phone: String(payload.phone ?? ""),
    profile_photo: String(payload.profile_photo ?? ""),
    bio: String(payload.bio ?? ""),
    signup_provider: "password",
  });

  if (!result.ok && result.reason === "active_exists") {
    return NextResponse.redirect(new URL("/signup?error=exists", request.url));
  }

  return NextResponse.redirect(new URL("/signup/requested", request.url));
}
