import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";

import { demoPassword } from "@/lib/data/seed";
import { cleanEmptyStrings, getRecordId, normalizePayload, parseResource, readPayload, redirectBack, requireApiAccess, wantsJson } from "@/lib/server/api";
import { notifyApproversAboutLeaveRequest } from "@/lib/server/leave-requests";
import { createResource, listResource } from "@/lib/server/store";
import { logTaskChecklistActivity, logTaskCommentActivity } from "@/lib/server/task-activity";
import { syncTaskWorkflowStatus } from "@/lib/server/task-workflow";
import { setLeaderApprovalRequirement } from "@/lib/task-approval";
import type { LeaveRequest, User } from "@/lib/types";
import { UploadError } from "@/lib/server/uploads";

const departmentPhraseCodes: Record<string, string> = {
  "board": "bod",
  "board of directors": "bod",
  "bod": "bod",
  "human resource": "hr",
  "human resources": "hr",
  "hr": "hr",
  "social media": "socmed",
  "social media specialist": "socmedspec",
};

const departmentWordCodes: Record<string, string> = {
  social: "soc",
  media: "med",
  specialist: "spec",
  resources: "res",
  resource: "res",
  operations: "ops",
};

function normalizeDepartmentName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeDepartmentId(name: string) {
  const normalized = normalizeDepartmentName(name);
  if (!normalized) return "";
  const phraseCode = departmentPhraseCodes[normalized];
  if (phraseCode) return `dept_${phraseCode}`;

  const words = normalized.split(" ").filter(Boolean);
  const code = words
    .map((word) => departmentWordCodes[word] ?? word)
    .join("")
    .slice(0, 32);

  return `dept_${code}`;
}

async function uniqueDepartmentId(name: string) {
  const baseId = makeDepartmentId(name);
  if (!baseId) return "";

  const departments = await listResource("Departments");
  const existingIds = new Set(departments.map((department) => department.department_id));
  if (!existingIds.has(baseId)) return baseId;

  let index = 2;
  while (existingIds.has(`${baseId}_${index}`)) index += 1;
  return `${baseId}_${index}`;
}

function makeTicketPrefix(value: string) {
  const words = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !["AND", "THE", "FOR", "OF"].includes(word));

  if (words.length >= 2) return words.map((word) => word[0]).join("").slice(0, 5);
  return (words[0] ?? "ATM").slice(0, 5);
}

async function nextTicketId(projectId: string, title: string) {
  const [projects, tasks] = await Promise.all([listResource("Projects"), listResource("Tasks")]);
  const project = projects.find((candidate) => candidate.project_id === projectId);
  const prefix = String(project?.ticket_id_prefix || "").trim().toUpperCase() || makeTicketPrefix(project?.project_name || title || "Akaal Task");
  const pattern = new RegExp(`^${prefix}-(\\d{3,})$`);
  const nextNumber =
    tasks.reduce((max, task) => {
      const match = pattern.exec(task.task_id);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

function parseChecklistTitles(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => String(item ?? "").split(/\r?\n|,/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function usersForAnnouncement(payload: Record<string, unknown>, users: User[]) {
  const targetUsers = Array.isArray(payload.target_users) ? payload.target_users.map(String).filter(Boolean) : [];
  const targetDepartment = String(payload.target_department ?? "all");
  const activeUsers = users.filter((user) => user.is_active);
  const ids = new Set<string>();

  if (targetDepartment === "all" && targetUsers.length === 0) {
    activeUsers.forEach((user) => ids.add(user.user_id));
  }

  if (targetDepartment && targetDepartment !== "all") {
    activeUsers.filter((user) => user.department_id === targetDepartment).forEach((user) => ids.add(user.user_id));
  }

  targetUsers.forEach((userId) => ids.add(userId));
  return activeUsers.filter((user) => ids.has(user.user_id));
}

export async function GET(_request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const { resource: resourceParam } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "read");
  if (access.error) return access.error;

  return NextResponse.json({ data: await listResource(resource) });
}

export async function POST(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const { resource: resourceParam } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "write");
  if (access.error) return access.error;

  let payload: Record<string, unknown>;
  try {
    payload = normalizePayload(cleanEmptyStrings(await readPayload(request)));
  } catch (error) {
    if (error instanceof UploadError) {
      return wantsJson(request) ? NextResponse.json({ error: error.message }, { status: 400 }) : redirectBack(request);
    }
    throw error;
  }

  const now = new Date().toISOString();
  const checklistTitles = resource === "Tasks" ? parseChecklistTitles(payload.checklist_titles) : [];
  delete payload.checklist_titles;

  if (resource === "Users") {
    payload.password_hash_or_auth_id = await bcrypt.hash(String(payload.password ?? demoPassword), 10);
    delete payload.password;
    payload.profile_photo ??= "";
    payload.bio ??= "";
    payload.is_active ??= true;
    payload.signup_status ??= "verified";
    payload.signup_provider ??= "password";
    payload.verification_key_hash ??= "";
    payload.verification_expires_at ??= "";
    payload.requested_at ??= "";
    payload.approved_at ??= now;
    payload.rejected_at ??= "";
    payload.rejection_reason ??= "";
    payload.created_at ??= now;
    payload.updated_at ??= now;
  }

  if (resource === "Task_Comments") {
    payload.mentions ??= [];
    payload.updated_at ??= now;
  }

  if (resource === "Tasks") {
    const needLeaderApproval = Boolean(payload.need_leader_approval);
    payload.task_id ||= await nextTicketId(String(payload.project_id ?? ""), String(payload.title ?? ""));
    payload.assigned_by ??= access.user.user_id;
    payload.assigned_to = Array.isArray(payload.assigned_to) && payload.assigned_to.length > 0 ? payload.assigned_to : [access.user.user_id];
    payload.status ??= "To Do";
    payload.priority ??= "Medium";
    payload.progress = 0;
    payload.labels = setLeaderApprovalRequirement(Array.isArray(payload.labels) ? payload.labels : [], needLeaderApproval);
    payload.need_leader_approval = needLeaderApproval;
    payload.completed_at ??= "";
  }

  if (resource === "Projects") {
    payload.owner_user_id ??= access.user.user_id;
    payload.members = Array.isArray(payload.members) && payload.members.length > 0 ? payload.members : [String(payload.owner_user_id)];
    payload.ticket_id_prefix = String(payload.ticket_id_prefix || makeTicketPrefix(String(payload.project_name ?? ""))).toUpperCase();
    payload.priority ??= "Medium";
    payload.status ??= "Not Started";
    payload.progress = Number(payload.progress ?? 0);
    payload.notes ??= "";
    payload.links = Array.isArray(payload.links) ? payload.links : [];
  }

  if (resource === "Task_Checklists") {
    payload.assignee_completed ??= payload.is_completed ?? false;
    payload.assignee_completed_by ??= payload.assignee_completed ? access.user.user_id : "";
    payload.pm_approved ??= false;
    payload.pm_approved_by ??= "";
    payload.is_completed = payload.assignee_completed;
  }

  if (resource === "Departments") {
    payload.department_id ||= await uniqueDepartmentId(String(payload.department_name ?? ""));
    payload.leader_user_id ??= "";
  }

  if (resource === "Leave_Requests") {
    payload.status ??= "Pending Approval";
    payload.approved_by ??= "";
    payload.approval_note ??= "";
  }

  if (resource === "Announcements") {
    payload.target_department ??= "all";
    payload.target_users ??= [];
    payload.scheduled_at ??= now;
    payload.is_pinned ??= false;
  }

  const record = await createResource(resource, payload as never);
  const entityId = getRecordId(record as unknown as Record<string, unknown>, resource);

  if (resource === "Leave_Requests") {
    const users = await listResource("Users");
    const requester = users.find((user) => user.user_id === String(payload.user_id ?? access.user.user_id)) as User | undefined;
    if (requester) {
      await notifyApproversAboutLeaveRequest(record as LeaveRequest, requester);
    }
  }

  if (resource === "Tasks" && Array.isArray(payload.assigned_to)) {
    await Promise.all(
      payload.assigned_to.map((userId) =>
        createResource("Notifications", {
          user_id: String(userId),
          title: "New task assigned",
          description: `${access.user.full_name} assigned you: ${String(payload.title ?? "Untitled task")}`,
          type: "task_assigned",
          related_link: `/tasks/${entityId}`,
          is_read: false,
          created_at: now,
        }),
      ),
    );
  }

  if (resource === "Announcements") {
    const users = await listResource("Users");
    const recipients = usersForAnnouncement(payload, users);
    const description = String(payload.body ?? "").slice(0, 180);

    await Promise.all(
      recipients.map((user) =>
        createResource("Notifications", {
          user_id: user.user_id,
          title: `Announcement: ${String(payload.title ?? "New update")}`,
          description,
          type: "announcement",
          related_link: "/announcements",
          is_read: false,
          created_at: now,
        }),
      ),
    );
  }

  if (resource === "Tasks" && checklistTitles.length > 0) {
    await Promise.all(
      checklistTitles.map(async (title) => {
        await createResource("Task_Checklists", {
          task_id: entityId,
          title,
          is_completed: false,
          assignee_completed: false,
          assignee_completed_by: "",
          pm_approved: false,
          pm_approved_by: "",
          created_at: now,
          updated_at: now,
        });
        await logTaskChecklistActivity({
          userId: access.user.user_id,
          userName: access.user.full_name,
          taskId: entityId,
          action: "created",
          title,
        });
      }),
    );
  }

  if (resource === "Task_Checklists") {
    const taskId = String((record as unknown as Record<string, unknown>).task_id ?? "");
    const checklistTitle = String((record as { title?: string }).title ?? payload.title ?? "");
    if (taskId) {
      await logTaskChecklistActivity({
        userId: access.user.user_id,
        userName: access.user.full_name,
        taskId,
        action: "created",
        title: checklistTitle,
      });
      await syncTaskWorkflowStatus(taskId);
    }
  }

  if (resource === "Task_Comments") {
    const taskId = String((record as unknown as Record<string, unknown>).task_id ?? payload.task_id ?? "");
    const commentText = String((record as { comment?: string }).comment ?? payload.comment ?? "");
    if (taskId) {
      await logTaskCommentActivity({
        userId: access.user.user_id,
        userName: access.user.full_name,
        taskId,
        comment: commentText,
      });
    }
  }

  if (resource !== "Activity_Logs" && resource !== "Task_Checklists" && resource !== "Task_Comments") {
    await createResource("Activity_Logs", {
      user_id: access.user.user_id,
      action: "created",
      entity_type: resource,
      entity_id: entityId,
      description: `${access.user.full_name} created ${resource.replaceAll("_", " ")}.`,
      created_at: now,
    });
  }

  if (wantsJson(request)) return NextResponse.json({ data: record }, { status: 201 });
  if (resource === "Tasks") return NextResponse.redirect(new URL(`/tasks/${entityId}`, request.url));
  return redirectBack(request);
}
