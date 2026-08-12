import styles from "./request.module.css";
import { LeaveRequestView } from "@/components/app/views";
import { hasPermission } from "@/lib/permissions";
import { getAppData } from "@/lib/server/app-data";

export default async function AttendanceRequestPage() {
  const data = await getAppData(["Users", "Leave_Requests"]);
  return (
    <div className={styles.page}>
      <LeaveRequestView {...data} canApproveLeave={hasPermission(data.currentUser.role_id, "attendance:approve")} />
    </div>
  );
}
