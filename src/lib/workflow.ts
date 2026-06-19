import type { Task, TaskChecklist, TaskStatus } from "@/lib/types";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";

// Statuses a user can manually move a task into via the board "Move to" control.
export const workflowBoardStatuses = ["To Do", "In Progress", "Waiting Approval", "Ready", "Finished"] as const;

// Lanes rendered on the board. "Overdue" is a derived attention lane (computed from the
// due date, never set manually), so it is shown but not offered as a move target.
export const boardLaneStatuses = ["To Do", "In Progress", "Waiting Approval", "Ready", "Overdue", "Finished"] as const;

export function progressForWorkflowStatus(status: TaskStatus) {
  if (status === "Finished" || status === "Done" || status === "Approved") return 100;
  if (status === "Ready") return 90;
  if (status === "Waiting Approval") return 65;
  if (status === "In Progress" || status === "Need Revision") return 35;
  return 0;
}

export function deriveWorkflowStatus(task: Pick<Task, "status" | "labels" | "need_leader_approval">, checklists: TaskChecklist[]): TaskStatus {
  if (task.status === "Finished") return "Finished";
  if (checklists.length === 0) return task.status === "Done" || task.status === "Approved" ? "Finished" : task.status;

  const assigneeDoneCount = checklists.filter((item) => item.assignee_completed || item.is_completed).length;
  const leaderApprovedCount = checklists.filter((item) => item.pm_approved).length;

  if (!taskNeedsLeaderApproval(task)) {
    if (assigneeDoneCount === checklists.length) return "Ready";
    if (assigneeDoneCount > 0) return "In Progress";
    return "To Do";
  }

  if (leaderApprovedCount === checklists.length) return "Ready";
  if (assigneeDoneCount === checklists.length) return "Waiting Approval";
  if (assigneeDoneCount > 0) return "In Progress";
  return "To Do";
}
