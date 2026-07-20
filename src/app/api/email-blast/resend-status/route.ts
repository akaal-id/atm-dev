import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { isResendConfigured } from "@/lib/server/resend";

/** Reports whether server-side Resend env is configured (no per-user API keys). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = isResendConfigured();
  return NextResponse.json({
    data: {
      configured,
      status: configured ? "connected" : "not_configured",
      from_email: configured ? process.env.RESEND_FROM_EMAIL || "Akaal Team Management <onboarding@akaal.id>" : null,
      message: configured
        ? "Resend siap dipakai lewat konfigurasi server ATM."
        : "Set RESEND_API_KEY di environment server.",
    },
  });
}
