import { NextResponse, type NextRequest } from "next/server";

import { readPayload, redirectBack, requireApiPermission } from "@/lib/server/api";
import { approveLeaveRequest, rejectLeaveRequest } from "@/lib/server/leave-requests";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiPermission("attendance:approve");
  if (access.error) return access.error;

  const { id } = await context.params;
  const payload = await readPayload(request);
  const intent = String(payload.intent ?? "approve");

  if (intent === "reject") {
    await rejectLeaveRequest(id, access.user, String(payload.approval_note ?? ""));
    return redirectBack(request, "/attendance/request");
  }

  await approveLeaveRequest(id, access.user, String(payload.approval_note ?? ""));
  return redirectBack(request, "/attendance/request");
}

export async function DELETE() {
  return NextResponse.json({ error: "Use POST with intent=reject." }, { status: 405 });
}
