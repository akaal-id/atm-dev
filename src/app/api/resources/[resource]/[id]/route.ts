import { NextResponse, type NextRequest } from "next/server";

import { canApproveTaskAsLeader, hasPermission } from "@/lib/permissions";
import { cleanEmptyStrings, normalizePayload, parseResource, readPayload, redirectBack, requireApiAccess, wantsJson } from "@/lib/server/api";
import { awardTaskDonePoints } from "@/lib/server/gamification";
import { createResource, deleteResource, getResourceById, updateResource } from "@/lib/server/store";
import { cascadeDeleteTaskDependents } from "@/lib/server/task-delete";
import { logTaskChecklistActivity, logTaskChecklistToggleActivity } from "@/lib/server/task-activity";
import { syncTaskWorkflowStatus } from "@/lib/server/task-workflow";
import { UploadError } from "@/lib/server/uploads";
import { setLeaderApprovalRequirement, taskNeedsLeaderApproval } from "@/lib/task-approval";
import type { Task, TaskChecklist, TaskStatus } from "@/lib/types";
import { progressForWorkflowStatus, workflowBoardStatuses } from "@/lib/workflow";

export async function GET(_request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource: resourceParam, id } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "read");
  if (access.error) return access.error;

  const record = await getResourceById(resource, id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: record });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  let payload: Record<string, unknown>;
  try {
    payload = await readPayload(request);
  } catch (error) {
    if (error instanceof UploadError) {
      return wantsJson(request) ? NextResponse.json({ error: error.message }, { status: 400 }) : redirectBack(request);
    }
    throw error;
  }

  return patchResource(request, context, payload);
}

async function patchResource(request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }, payload: Record<string, unknown>) {
  const { resource: resourceParam, id } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "write");
  if (access.error) return access.error;

  const patch = normalizePayload(cleanEmptyStrings(payload));
  let previousAssignedTo: string[] = [];
  let existingTask: Task | undefined;

  if (
    resource === "Tasks" &&
    (patch.assigned_to !== undefined ||
      patch.status !== undefined ||
      patch.need_leader_approval !== undefined ||
      patch.labels !== undefined)
  ) {
    existingTask = (await getResourceById("Tasks", id)) as Task | undefined;
    previousAssignedTo = Array.isArray(existingTask?.assigned_to) ? existingTask.assigned_to : [];
  }

  if (resource === "Tasks") {
    delete patch.task_id;
    delete patch.project_id;

    if (patch.need_leader_approval !== undefined || patch.labels !== undefined) {
      const needLeaderApproval = patch.need_leader_approval !== undefined ? Boolean(patch.need_leader_approval) : taskNeedsLeaderApproval(existingTask as Task);
      const labels = patch.labels !== undefined ? patch.labels : existingTask?.labels;
      patch.need_leader_approval = needLeaderApproval;
      patch.labels = setLeaderApprovalRequirement(Array.isArray(labels) ? labels : [], needLeaderApproval);
    }
  }
  if (resource === "Leave_Requests" && (patch.status !== undefined || patch.approved_by !== undefined || patch.approval_note !== undefined)) {
    if (!hasPermission(access.user.role_id, "attendance:approve")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (resource === "Tasks" && patch.status !== undefined) {
    const nextStatus = String(patch.status) as TaskStatus;
    const canMoveAnyTask = hasPermission(access.user.role_id, "tasks:manage") || hasPermission(access.user.role_id, "tasks:team");
    const isAssignee = Array.isArray(existingTask?.assigned_to) && existingTask.assigned_to.includes(access.user.user_id);

    if (!workflowBoardStatuses.includes(nextStatus as (typeof workflowBoardStatuses)[number])) {
      return NextResponse.json({ error: "Unknown task board status" }, { status: 400 });
    }

    if (!canMoveAnyTask && !isAssignee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingTaskNeedsLeaderApproval = existingTask ? taskNeedsLeaderApproval(existingTask) : true;

    if (nextStatus === "Finished" && !canApproveTaskAsLeader(access.user) && !(isAssignee && !existingTaskNeedsLeaderApproval)) {
      return NextResponse.json({ error: "Only task assignees without leader approval, Managers, Admins, and Super Admins can finish tasks." }, { status: 403 });
    }

    patch.status = nextStatus;
    patch.progress = progressForWorkflowStatus(nextStatus);
    patch.completed_at = nextStatus === "Finished" ? new Date().toISOString() : "";
    // Stamp the first hand-off (Waiting Approval / Ready) and keep it sticky afterwards.
    const isHandoffStage = nextStatus === "Waiting Approval" || nextStatus === "Ready";
    patch.handed_off_at = isHandoffStage
      ? existingTask?.handed_off_at || new Date().toISOString()
      : existingTask?.handed_off_at || "";
  }

  if (resource === "Tasks" && patch.status === undefined) {
    delete patch.progress;
    delete patch.completed_at;
    delete patch.handed_off_at;
  }

  if (resource === "Projects" && patch.ticket_id_prefix !== undefined) {
    patch.ticket_id_prefix = String(patch.ticket_id_prefix).trim().toUpperCase();
  }

  let existingChecklist: TaskChecklist | undefined;

  if (resource === "Task_Checklists") {
    const existing = (await getResourceById("Task_Checklists", id)) as TaskChecklist | undefined;
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    existingChecklist = existing;
    const task = await getResourceById("Tasks", existing.task_id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const canManageTask = hasPermission(access.user.role_id, "tasks:manage") || hasPermission(access.user.role_id, "tasks:team");
    const canLeaderApprove = canApproveTaskAsLeader(access.user);
    const isAssignee = Array.isArray(task?.assigned_to) && task.assigned_to.includes(access.user.user_id);

    if (!canManageTask && !isAssignee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (patch.pm_approved !== undefined && !taskNeedsLeaderApproval(task as Task)) {
      return NextResponse.json({ error: "Leader approval is not required for this task." }, { status: 400 });
    }

    if (patch.pm_approved !== undefined && !canLeaderApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (patch.assignee_completed !== undefined) {
      patch.is_completed = patch.assignee_completed;
      patch.assignee_completed_by = patch.assignee_completed ? access.user.user_id : "";

      if (!patch.assignee_completed) {
        patch.pm_approved = false;
        patch.pm_approved_by = "";
      }
    }

    if (patch.pm_approved !== undefined) {
      patch.pm_approved_by = patch.pm_approved ? access.user.user_id : "";
    }

    if (patch.title !== undefined && !canManageTask && !isAssignee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const shouldAwardFinishedTask = resource === "Tasks" && patch.status === "Finished" && existingTask?.status !== "Finished";
  const record = await updateResource(resource, id, patch as never);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (resource === "Tasks") {
    await createResource("Activity_Logs", {
      user_id: access.user.user_id,
      action: "updated",
      entity_type: "Tasks",
      entity_id: id,
      description: `${access.user.full_name} updated task ${id}.`,
      created_at: new Date().toISOString(),
    });

    if (Array.isArray(patch.assigned_to)) {
      const nextAssignees = patch.assigned_to.map(String);
      const addedAssignees = nextAssignees.filter((userId) => !previousAssignedTo.includes(userId));

      await Promise.all(
        addedAssignees.map((userId) =>
          createResource("Notifications", {
            user_id: userId,
            title: "New task assignment",
            description: `${access.user.full_name} assigned you to: ${String((record as { title?: string }).title ?? id)}`,
            type: "task_assigned",
            related_link: `/tasks/${id}`,
            is_read: false,
            created_at: new Date().toISOString(),
          }),
        ),
      );
    }

    if (shouldAwardFinishedTask) {
      await Promise.all((record as Task).assigned_to.map((userId) => awardTaskDonePoints(record as Task, userId)));
    }
  }

  if (resource === "Task_Checklists" && existingChecklist) {
    const taskId = String((record as unknown as Record<string, unknown>).task_id ?? "");
    const checklistTitle = String((record as TaskChecklist).title ?? existingChecklist.title);
    const nextTitle = String((record as TaskChecklist).title ?? "");
    const wasAssigneeDone = existingChecklist.assignee_completed || existingChecklist.is_completed;
    const wasLeaderApproved = existingChecklist.pm_approved;
    const activityBase = {
      userId: access.user.user_id,
      userName: access.user.full_name,
      taskId,
      title: checklistTitle,
    };

    if (patch.title !== undefined && nextTitle && nextTitle !== existingChecklist.title && taskId) {
      await logTaskChecklistActivity({
        ...activityBase,
        action: "updated",
        title: nextTitle,
        previousTitle: existingChecklist.title,
      });
    }

    if (patch.assignee_completed !== undefined && taskId) {
      const nextAssigneeDone = Boolean(patch.assignee_completed);
      if (nextAssigneeDone !== wasAssigneeDone) {
        await logTaskChecklistToggleActivity({
          ...activityBase,
          role: "assignee",
          checked: nextAssigneeDone,
        });
      }
    }

    if (patch.pm_approved !== undefined && taskId) {
      const nextLeaderApproved = Boolean(patch.pm_approved);
      if (nextLeaderApproved !== wasLeaderApproved) {
        await logTaskChecklistToggleActivity({
          ...activityBase,
          role: "leader",
          checked: nextLeaderApproved,
        });
      }
    }

    if (taskId) await syncTaskWorkflowStatus(taskId);
  }

  return wantsJson(request) ? NextResponse.json({ data: record }) : redirectBack(request);
}

export async function POST(request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  let payload: Record<string, unknown>;
  try {
    payload = await readPayload(request);
  } catch (error) {
    if (error instanceof UploadError) {
      return wantsJson(request) ? NextResponse.json({ error: error.message }, { status: 400 }) : redirectBack(request);
    }
    throw error;
  }

  const method = String(payload._method ?? payload.intent ?? "").toLowerCase();

  if (method === "delete") {
    return DELETE(request, context);
  }

  return patchResource(request, context, payload);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource: resourceParam, id } = await context.params;
  const resource = parseResource(resourceParam);
  if (!resource) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const access = await requireApiAccess(resource, "write");
  if (access.error) return access.error;

  if (resource === "Users" && id === access.user.user_id) {
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  }

  let checklistTaskId = "";
  let deletedChecklist: TaskChecklist | undefined;

  if (resource === "Tasks") {
    const existingTask = (await getResourceById("Tasks", id)) as Task | undefined;
    if (!existingTask) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canDelete =
      hasPermission(access.user.role_id, "tasks:manage") || existingTask.assigned_by === access.user.user_id;
    if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await cascadeDeleteTaskDependents(id);
  }

  if (resource === "Task_Checklists") {
    const existing = (await getResourceById("Task_Checklists", id)) as TaskChecklist | undefined;
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const task = await getResourceById("Tasks", existing.task_id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const canManageTask = hasPermission(access.user.role_id, "tasks:manage") || hasPermission(access.user.role_id, "tasks:team");
    const isAssignee = Array.isArray(task.assigned_to) && task.assigned_to.includes(access.user.user_id);
    if (!canManageTask && !isAssignee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    deletedChecklist = existing;
    checklistTaskId = String(existing.task_id ?? "");
  }

  const deleted = await deleteResource(resource, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (resource === "Tasks") {
    await createResource("Activity_Logs", {
      user_id: access.user.user_id,
      action: "deleted",
      entity_type: "Tasks",
      entity_id: id,
      description: `${access.user.full_name} deleted task ${id}.`,
      created_at: new Date().toISOString(),
    });
  }

  if (deletedChecklist) {
    await logTaskChecklistActivity({
      userId: access.user.user_id,
      userName: access.user.full_name,
      taskId: deletedChecklist.task_id,
      action: "deleted",
      title: deletedChecklist.title,
    });
  }

  if (checklistTaskId) {
    await syncTaskWorkflowStatus(checklistTaskId);
  }

  if (resource === "Users" && !wantsJson(request)) {
    return NextResponse.redirect(new URL("/employees", request.url));
  }

  if (resource === "Tasks" && !wantsJson(request)) {
    return NextResponse.redirect(new URL("/tasks/my", request.url));
  }

  return wantsJson(request) ? NextResponse.json({ ok: true }) : redirectBack(request);
}
