import "server-only";

import { hasPermission } from "@/lib/permissions";
import { createResource, listResource, updateResource } from "@/lib/server/store";
import type { LeaveRequest, User } from "@/lib/types";

interface AdminActor {
  user_id: string;
  full_name: string;
}

function isPending(request: LeaveRequest) {
  return request.status === "Pending Approval";
}

export async function approveLeaveRequest(requestId: string, adminUser: AdminActor, approvalNote = "") {
  const requests = await listResource("Leave_Requests");
  const request = requests.find((candidate) => candidate.request_id === requestId) as LeaveRequest | undefined;
  if (!request) return { ok: false, reason: "not_found" as const };
  if (!isPending(request)) return { ok: false, reason: "not_pending" as const };

  const now = new Date().toISOString();
  await updateResource("Leave_Requests", requestId, {
    status: "Approved",
    approved_by: adminUser.user_id,
    approval_note: approvalNote.trim(),
    updated_at: now,
  });

  await createResource("Notifications", {
    user_id: request.user_id,
    title: "Leave request approved",
    description: `Your ${request.request_type} request (${request.start_date} to ${request.end_date}) was approved.`,
    type: "leave_approved",
    related_link: "/attendance/request",
    is_read: false,
    created_at: now,
  });

  await createResource("Activity_Logs", {
    user_id: adminUser.user_id,
    action: "approved",
    entity_type: "Leave_Requests",
    entity_id: requestId,
    description: `${adminUser.full_name} approved a leave request.`,
    created_at: now,
  });

  return { ok: true };
}

export async function rejectLeaveRequest(requestId: string, adminUser: AdminActor, approvalNote: string) {
  const requests = await listResource("Leave_Requests");
  const request = requests.find((candidate) => candidate.request_id === requestId) as LeaveRequest | undefined;
  if (!request) return { ok: false, reason: "not_found" as const };
  if (!isPending(request)) return { ok: false, reason: "not_pending" as const };

  const now = new Date().toISOString();
  const note = approvalNote.trim();
  await updateResource("Leave_Requests", requestId, {
    status: "Rejected",
    approved_by: adminUser.user_id,
    approval_note: note,
    updated_at: now,
  });

  await createResource("Notifications", {
    user_id: request.user_id,
    title: "Leave request rejected",
    description: note
      ? `Your ${request.request_type} request was not approved. Note: ${note}`
      : `Your ${request.request_type} request (${request.start_date} to ${request.end_date}) was not approved.`,
    type: "leave_rejected",
    related_link: "/attendance/request",
    is_read: false,
    created_at: now,
  });

  await createResource("Activity_Logs", {
    user_id: adminUser.user_id,
    action: "rejected",
    entity_type: "Leave_Requests",
    entity_id: requestId,
    description: `${adminUser.full_name} rejected a leave request.`,
    created_at: now,
  });

  return { ok: true };
}

export async function notifyApproversAboutLeaveRequest(request: LeaveRequest, requester: User) {
  const users = await listResource("Users");
  const approvers = users.filter(
    (candidate) => candidate.is_active && candidate.user_id !== requester.user_id && hasPermission(candidate.role_id, "attendance:approve"),
  );

  const now = new Date().toISOString();
  await Promise.all(
    approvers.map((approver) =>
      createResource("Notifications", {
        user_id: approver.user_id,
        title: "Leave request pending approval",
        description: `${requester.full_name} submitted a ${request.request_type} request (${request.start_date} to ${request.end_date}).`,
        type: "leave_request",
        related_link: "/attendance/request",
        is_read: false,
        created_at: now,
      }),
    ),
  );
}
