import { NextResponse, type NextRequest } from "next/server";

import { parseSignupFormData, resolveSignupRedirectPath } from "@/lib/server/signup-form";
import { UploadError } from "@/lib/server/uploads";

export async function POST(request: NextRequest) {
  let errorBase = "/signup";
  try {
    const input = await parseSignupFormData(await request.formData());
    errorBase = input.account_type === "org_owner" ? "/signup/organization" : "/signup";
    const redirectPath = await resolveSignupRedirectPath(input);
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.redirect(new URL(`${errorBase}?error=upload`, request.url));
    }

    console.error("Signup request failed", error);
    return NextResponse.redirect(new URL(`${errorBase}?error=server`, request.url));
  }
}
