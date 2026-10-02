import styles from "./approvals.module.css";

import { LeaveApprovalsView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";
import { requirePermission } from "@/lib/server/auth";

export default async function AttendanceApprovalsPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string }> }) {
  await requirePermission("attendance:approve");
  const [{ type = "All", status = "Pending Approval" }, data] = await Promise.all([searchParams, getAppData(["Users", "Leave_Requests"])]);
  return (
    <div className={styles.page}>
      <LeaveApprovalsView data={data} type={type} status={status} />
    </div>
  );
}
