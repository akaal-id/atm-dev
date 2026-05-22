import { AttendanceView } from "@/components/app/views";
import { hasPermission } from "@/lib/permissions";
import { getAppData } from "@/lib/server/app-data";

export default async function AttendancePage() {
  const data = await getAppData();
  return <AttendanceView {...data} canApproveLeave={hasPermission(data.currentUser.role_id, "attendance:approve")} />;
}
