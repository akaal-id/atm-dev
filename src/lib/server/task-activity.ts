import "server-only";

import { createResource } from "@/lib/server/store";

type ChecklistActivityAction = "created" | "updated" | "deleted";
type ChecklistToggleRole = "assignee" | "leader";

export function checklistActivityDescription(
  userName: string,
  action: ChecklistActivityAction,
  title: string,
  previousTitle?: string,
) {
  if (action === "updated" && previousTitle && previousTitle !== title) {
    return `${userName} updated checklist "${previousTitle}" to "${title}"`;
  }

  return `${userName} ${action} checklist "${title}"`;
}

export function checklistToggleActivityDescription(
  userName: string,
  role: ChecklistToggleRole,
  title: string,
  checked: boolean,
) {
  if (role === "assignee") {
    return checked
      ? `${userName} checked checklist "${title}" as assignee`
      : `${userName} unchecked checklist "${title}" as assignee`;
  }

  return checked
    ? `Leader approved checklist "${title}"`
    : `Leader unapproved checklist "${title}"`;
}

export async function logTaskChecklistToggleActivity({
  userId,
  userName,
  taskId,
  role,
  title,
  checked,
}: {
  userId: string;
  userName: string;
  taskId: string;
  role: ChecklistToggleRole;
  title: string;
  checked: boolean;
}) {
  if (!taskId || !title) return;

  await createResource("Activity_Logs", {
    user_id: userId,
    action: checked ? "checked" : "unchecked",
    entity_type: "Tasks",
    entity_id: taskId,
    description: checklistToggleActivityDescription(userName, role, title, checked),
    created_at: new Date().toISOString(),
  });
}

function commentPreview(text: string, maxLength = 80) {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (!singleLine) return "…";
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1)}…`;
}

export function commentActivityDescription(userName: string, comment: string) {
  return `${userName} commented "${commentPreview(comment)}"`;
}

export async function logTaskCommentActivity({
  userId,
  userName,
  taskId,
  comment,
}: {
  userId: string;
  userName: string;
  taskId: string;
  comment: string;
}) {
  if (!taskId || !comment.trim()) return;

  await createResource("Activity_Logs", {
    user_id: userId,
    action: "commented",
    entity_type: "Tasks",
    entity_id: taskId,
    description: commentActivityDescription(userName, comment),
    created_at: new Date().toISOString(),
  });
}

export async function logTaskChecklistActivity({
  userId,
  userName,
  taskId,
  action,
  title,
  previousTitle,
}: {
  userId: string;
  userName: string;
  taskId: string;
  action: ChecklistActivityAction;
  title: string;
  previousTitle?: string;
}) {
  if (!taskId || !title) return;

  await createResource("Activity_Logs", {
    user_id: userId,
    action,
    entity_type: "Tasks",
    entity_id: taskId,
    description: checklistActivityDescription(userName, action, title, previousTitle),
    created_at: new Date().toISOString(),
  });
}
