import { Badge } from "@/components/ui/badge";

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
