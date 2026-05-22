"use server";

import { redirect } from "next/navigation";

import { parseSignupFormData, resolveSignupRedirectPath } from "@/lib/server/signup-form";
import { UploadError } from "@/lib/server/uploads";

export async function submitSignupRequest(formData: FormData) {
  try {
    const input = await parseSignupFormData(formData);
    redirect(await resolveSignupRedirectPath(input));
  } catch (error) {
    if (error instanceof UploadError) {
      redirect("/signup?error=upload");
    }
    throw error;
  }
}
