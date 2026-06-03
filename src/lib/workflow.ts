import type { Task, TaskChecklist, TaskStatus } from "@/lib/types";

export const workflowBoardStatuses = ["To Do", "In Progress", "Waiting Approval", "Ready", "Finished"] as const;

export function progressForWorkflowStatus(status: TaskStatus) {
  if (status === "Finished" || status === "Done" || status === "Approved") return 100;
  if (status === "Ready") return 90;
  if (status === "Waiting Approval") return 65;
  if (status === "In Progress" || status === "Need Revision") return 35;
  return 0;
}

export function deriveWorkflowStatus(task: Pick<Task, "status">, checklists: TaskChecklist[]): TaskStatus {
  if (task.status === "Finished") return "Finished";
  if (checklists.length === 0) return task.status === "Done" || task.status === "Approved" ? "Finished" : task.status;

  const assigneeDoneCount = checklists.filter((item) => item.assignee_completed || item.is_completed).length;
  const pmApprovedCount = checklists.filter((item) => item.pm_approved).length;

  if (pmApprovedCount === checklists.length) return "Ready";
  if (assigneeDoneCount === checklists.length) return "Waiting Approval";
  if (assigneeDoneCount > 0) return "In Progress";
  return "To Do";
}
