import { NextResponse, type NextRequest } from "next/server";

import { readPayload, redirectBack, requireApiPermission } from "@/lib/server/api";
import { approveSignupRequest, rejectSignupRequest } from "@/lib/server/account-requests";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiPermission("employees:manage");
  if (access.error) return access.error;

  const { id } = await context.params;
  const payload = await readPayload(request);
  const intent = String(payload.intent ?? "approve");

  if (intent === "reject") {
    await rejectSignupRequest(id, access.user, String(payload.rejection_reason ?? ""));
    return redirectBack(request, "/admin");
  }

  await approveSignupRequest(id, access.user);
  return redirectBack(request, "/admin");
}

export async function DELETE() {
  return NextResponse.json({ error: "Use POST with intent=reject." }, { status: 405 });
}
