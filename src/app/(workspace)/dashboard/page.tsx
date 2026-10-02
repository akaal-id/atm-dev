import styles from "./dashboard.module.css";
import { DashboardView } from "@/components/app/dashboard";
import { jakartaToday } from "@/lib/metrics";
import { getAppData } from "@/lib/server/app-data";
import { sessionsOn } from "@/lib/server/attendance-history";
import { currentMonthScores } from "@/lib/server/scoring";

export default async function DashboardPage() {
  const [data, scores, sessions] = await Promise.all([
    getAppData(["Users", "Tasks", "Attendance", "Leave_Requests", "Announcements", "Calendar_Events"]),
    currentMonthScores(),
    sessionsOn(jakartaToday()),
  ]);

  return (
    <div className={styles.page}>
      <DashboardView data={data} monthScore={scores[data.currentUser.user_id]} sessions={sessions} />
    </div>
  );
}
