import styles from "./attendance.module.css";
import { AttendanceView } from "@/components/app/views";
import { type HistoryView, jakartaToday, periodRange } from "@/lib/attendance-history";
import { hasPermission } from "@/lib/permissions";
import { getAppData } from "@/lib/server/app-data";
import { getAttendanceHistory } from "@/lib/server/attendance-history";
import { officeForDisplay } from "@/lib/server/attendance-location";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; page?: string }> }) {
  const params = await searchParams;
  const view: HistoryView = params.view === "day" || params.view === "week" ? params.view : "month";
  const anchor = params.date && DATE.test(params.date) ? params.date : jakartaToday();
  const { start, end } = periodRange(view, anchor);
  const [data, office] = await Promise.all([getAppData(["Users", "Attendance", "Leave_Requests"]), officeForDisplay()]);
  const rows = await getAttendanceHistory(start, end, [data.currentUser]);

  return (
    <div className={styles.page}>
      <AttendanceView
        {...data}
        canApproveLeave={hasPermission(data.currentUser.role_id, "attendance:approve")}
        canViewTeam={hasPermission(data.currentUser.role_id, "attendance:team")}
        office={office}
        myAttendance={{ rows, view, anchor, page: Number(params.page) || 1 }}
      />
    </div>
  );
}
