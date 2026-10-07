import styles from "./tasks.module.css";

import { MenuHub } from "@/components/app/menu-hub";
import { hubSections } from "@/lib/menu-hub";
import { filterNavigation, taskNavigation } from "@/lib/navigation";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/server/auth";

/** Task menu: what the Task tab opens on phones (and the "Tasks" breadcrumb). */
export default async function TasksMenuPage() {
  const user = await requireUser();
  const items = filterNavigation(taskNavigation, (permission) => hasPermission(user.role_id, permission));
  return (
    <div className={styles.page}>
      <MenuHub sections={hubSections("Task", items)} />
    </div>
  );
}
