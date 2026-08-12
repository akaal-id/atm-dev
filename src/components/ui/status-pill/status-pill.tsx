import { Badge } from "@/components/ui/badge";
import { isTaskOverdue } from "@/lib/metrics";
import type { TaskStatus } from "@/lib/types";
import styles from "./status-pill.module.css";

export function statusTone(status: string) {
  if (["Done", "Completed", "Approved", "Ready", "Finished", "Present"].includes(status)) return "green";
  if (["In Progress", "Waiting for Review", "Waiting Approval", "Work From Home"].includes(status)) return "blue";
  if (["Need Revision", "Revision", "Pending Approval", "Late", "Half Day"].includes(status)) return "yellow";
  if (["Rejected", "Cancelled", "Absent", "Overdue"].includes(status)) return "red";
  return "neutral";
}

export function StatusPill({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}

// Overdue is a derived attention tag, never a stored stage. It sits *next to* the real
// workflow status instead of replacing it, e.g. [In Progress] [Overdue].
export function TaskStatusPill({ status, dueDate, handedOffAt }: { status: TaskStatus; dueDate?: string; handedOffAt?: string }) {
  if (!isTaskOverdue({ status, due_date: dueDate ?? "", handed_off_at: handedOffAt })) {
    return <StatusPill status={status} />;
  }

  return (
    <span className={styles.taskstatuspill}>
      <StatusPill status={status} />
      <StatusPill status="Overdue" />
    </span>
  );
}
