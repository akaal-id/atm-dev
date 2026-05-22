import { NextResponse, type NextRequest } from "next/server";

import { readPayload } from "@/lib/server/api";
import { createSignupRequest } from "@/lib/server/account-requests";

export async function POST(request: NextRequest) {
  const payload = await readPayload(request);
  const fullName = String(payload.full_name ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const confirmPassword = String(payload.confirm_password ?? "");

  if (!fullName || !email || !password || password.length < 8 || password !== confirmPassword) {
    return NextResponse.redirect(new URL("/signup?error=invalid", request.url));
  }

  const result = await createSignupRequest({
    full_name: fullName,
    email,
    password,
    department_id: String(payload.department_id ?? ""),
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
