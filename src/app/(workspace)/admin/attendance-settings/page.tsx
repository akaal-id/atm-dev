import styles from "./attendance-settings.module.css";
import { AttendanceSettingsView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function AdminAttendanceSettingsPage() {
  await requirePermission("settings:manage");
  const data = await getAppData(["Settings"]);
  return (
    <div className={styles.page}>
      <AttendanceSettingsView {...data} />
    </div>
  );
}
