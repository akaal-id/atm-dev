import { NextResponse, type NextRequest } from "next/server";

import { readPayload } from "@/lib/server/api";
import { parseSignupPayload, resolveSignupRedirectPath } from "@/lib/server/signup-form";
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

  const redirectPath = await resolveSignupRedirectPath(parseSignupPayload(payload));
  return NextResponse.redirect(new URL(redirectPath, request.url));
}
