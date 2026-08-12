import styles from "./dashboard.module.css";
import { DashboardView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";
import { listResourceByField } from "@/lib/server/store";

export default async function DashboardPage() {
  const data = await getAppData([
    "Users",
    "Tasks",
    "Attendance",
    "Leave_Requests",
    "Announcements",
    "Activity_Logs",
  ]);
  data.notifications = await listResourceByField("Notifications", "user_id", data.currentUser.user_id, {
    limit: 50,
    orderBy: "created_at",
  });

  return (
    <div className={styles.page}>
      <DashboardView {...data} />
    </div>
  );
}
