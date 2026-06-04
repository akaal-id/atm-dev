import type { Task } from "@/lib/types";

export const LEADER_APPROVAL_LABEL = "__atm_need_leader_approval";

type ApprovalTask = Pick<Task, "labels"> & {
  need_leader_approval?: boolean | string | number;
};

function ensureLabels(labels: unknown) {
  return Array.isArray(labels) ? labels.map(String).filter(Boolean) : [];
}

export function visibleTaskLabels(labels: unknown) {
  return ensureLabels(labels).filter((label) => label !== LEADER_APPROVAL_LABEL);
}

export function taskNeedsLeaderApproval(task: ApprovalTask) {
  return task.need_leader_approval === true || task.need_leader_approval === "true" || task.need_leader_approval === 1 || ensureLabels(task.labels).includes(LEADER_APPROVAL_LABEL);
}

export function setLeaderApprovalRequirement(labels: unknown, required: boolean) {
  const visibleLabels = visibleTaskLabels(labels);
  return required ? [...visibleLabels, LEADER_APPROVAL_LABEL] : visibleLabels;
}
