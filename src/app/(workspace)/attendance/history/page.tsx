import styles from "./history.module.css";

import { AttendanceHistoryView } from "@/components/app/attendance-history";
import { type HistoryView, jakartaToday, periodRange } from "@/lib/attendance-history";
import { getAttendanceHistory } from "@/lib/server/attendance-history";
import { requirePermission } from "@/lib/server/auth";
import { listResource } from "@/lib/server/store";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AttendanceHistoryPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; page?: string }> }) {
  await requirePermission("attendance:team");
  const params = await searchParams;
  const view: HistoryView = params.view === "day" || params.view === "month" ? params.view : "week";
  const anchor = params.date && DATE.test(params.date) ? params.date : jakartaToday();
  const { start, end } = periodRange(view, anchor);
  const rows = await getAttendanceHistory(start, end, await listResource("Users"));

  return (
    <div className={styles.page}>
      <AttendanceHistoryView rows={rows} view={view} anchor={anchor} page={Number(params.page) || 1} />
    </div>
  );
}
