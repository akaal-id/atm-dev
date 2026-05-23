import { NextResponse, type NextRequest } from "next/server";

import { parseSignupFormData, resolveSignupRedirectPath } from "@/lib/server/signup-form";
import { UploadError } from "@/lib/server/uploads";

export async function POST(request: NextRequest) {
  try {
    const input = await parseSignupFormData(await request.formData());
    const redirectPath = await resolveSignupRedirectPath(input);
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.redirect(new URL("/signup?error=upload", request.url));
    }

    console.error("Signup request failed", error);
    return NextResponse.redirect(new URL("/signup?error=server", request.url));
  }
}
