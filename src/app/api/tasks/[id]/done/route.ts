import { NextResponse, type NextRequest } from "next/server";

import { canApproveTaskAsLeader } from "@/lib/permissions";
import { awardTaskDonePoints } from "@/lib/server/gamification";
import { redirectBack, requireApiPermission, wantsJson } from "@/lib/server/api";
import { createResource, getResourceById, listResource, updateResource } from "@/lib/server/store";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";
import type { Task } from "@/lib/types";
import { progressForWorkflowStatus } from "@/lib/workflow";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiPermission("tasks:own");
  if (access.error) return access.error;

  const { id } = await context.params;
  const task = (await getResourceById("Tasks", id)) as Task | undefined;
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const canLeaderFinish = canApproveTaskAsLeader(access.user);
  const isAssignee = task.assigned_to.includes(access.user.user_id);

  if (!canLeaderFinish && !isAssignee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const checklist = (await listResource("Task_Checklists")).filter((item) => item.task_id === id);
  const needsLeaderApproval = taskNeedsLeaderApproval(task);
  const leaderApprovalComplete = checklist.length > 0 ? checklist.every((item) => item.pm_approved) : canLeaderFinish;

  if (needsLeaderApproval && !leaderApprovalComplete) {
    return wantsJson(request)
      ? NextResponse.json({ error: "Leader approval is required before this task can be finished." }, { status: 409 })
      : redirectBack(request, `/tasks/${id}`);
  }

  if (task.status !== "Finished") {
    if (checklist.length > 0) {
      await Promise.all(
        checklist.map((item) =>
          updateResource("Task_Checklists", item.checklist_id, {
            is_completed: true,
            assignee_completed: true,
            assignee_completed_by: access.user.user_id,
            ...(needsLeaderApproval ? {} : { pm_approved: false, pm_approved_by: "" }),
          }),
        ),
      );
    }

    await updateResource("Tasks", id, {
      status: "Finished",
      progress: progressForWorkflowStatus("Finished"),
      completed_at: now,
    });
  }

  if (task.status !== "Finished") {
    await Promise.all(task.assigned_to.map((userId) => awardTaskDonePoints(task, userId)));
  }

  await createResource("Activity_Logs", {
    user_id: access.user.user_id,
    action: "done",
    entity_type: "Tasks",
    entity_id: id,
    description: `${access.user.full_name} marked task ${id} as done.`,
    created_at: now,
  });

  return wantsJson(request) ? NextResponse.json({ ok: true }) : redirectBack(request, `/tasks/${id}`);
}
