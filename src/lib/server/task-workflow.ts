import "server-only";

import { deriveWorkflowStatus, progressForWorkflowStatus } from "@/lib/workflow";
import { getResourceById, listResource, updateResource } from "@/lib/server/store";
import type { Task } from "@/lib/types";

export async function syncTaskWorkflowStatus(taskId: string) {
  const task = (await getResourceById("Tasks", taskId)) as Task | undefined;
  if (!task) return null;

  const checklists = (await listResource("Task_Checklists")).filter((item) => item.task_id === taskId);
  const nextStatus = deriveWorkflowStatus(task, checklists);
  const nextProgress = progressForWorkflowStatus(nextStatus);
  const nextCompletedAt = nextStatus === "Finished" ? task.completed_at || new Date().toISOString() : task.completed_at || "";

  if (task.status === nextStatus && task.progress === nextProgress && (task.completed_at || "") === nextCompletedAt) {
    return task;
  }

  return updateResource("Tasks", taskId, {
    status: nextStatus,
    progress: nextProgress,
    completed_at: nextCompletedAt,
  });
}
