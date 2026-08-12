import styles from "./announcements.module.css";
import { AnnouncementsView } from "@/components/app/views";
import { hasPermission } from "@/lib/permissions";
import { getAppData } from "@/lib/server/app-data";

export default async function AnnouncementsPage() {
  const data = await getAppData(["Users", "Announcements"]);
  return (
    <div className={styles.page}>
      <AnnouncementsView {...data} canManage={hasPermission(data.currentUser.role_id, "announcements:manage")} />
    </div>
  );
}
