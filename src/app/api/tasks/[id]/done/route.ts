import { NextResponse, type NextRequest } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { awardTaskDonePoints } from "@/lib/server/gamification";
import { redirectBack, requireApiPermission, wantsJson } from "@/lib/server/api";
import { createResource, getResourceById, listResource, updateResource } from "@/lib/server/store";
import { syncTaskWorkflowStatus } from "@/lib/server/task-workflow";
import type { Task } from "@/lib/types";
import { progressForWorkflowStatus } from "@/lib/workflow";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiPermission("tasks:own");
  if (access.error) return access.error;

  const { id } = await context.params;
  const task = (await getResourceById("Tasks", id)) as Task | undefined;
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const canManageTask = hasPermission(access.user.role_id, "tasks:manage") || hasPermission(access.user.role_id, "tasks:team");
  const isAssignee = task.assigned_to.includes(access.user.user_id);

  if (!canManageTask && !isAssignee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (task.status !== "Finished") {
    const checklist = (await listResource("Task_Checklists")).filter((item) => item.task_id === id);

    if (checklist.length > 0) {
      await Promise.all(
        checklist.map((item) =>
          updateResource("Task_Checklists", item.checklist_id, {
            is_completed: true,
            assignee_completed: true,
            assignee_completed_by: access.user.user_id,
          }),
        ),
      );
      await syncTaskWorkflowStatus(id);
    } else {
      await updateResource("Tasks", id, {
        status: "Waiting Approval",
        progress: progressForWorkflowStatus("Waiting Approval"),
        completed_at: "",
      });
    }
  }

  if (isAssignee) {
    await awardTaskDonePoints(task, access.user.user_id);
  }

  await createResource("Activity_Logs", {
    user_id: access.user.user_id,
    action: "done",
    entity_type: "Tasks",
    entity_id: id,
    description: `${access.user.full_name} marked task ${id} as done.`,
    created_at: new Date().toISOString(),
  });

  return wantsJson(request) ? NextResponse.json({ ok: true }) : redirectBack(request, `/tasks/${id}`);
}
