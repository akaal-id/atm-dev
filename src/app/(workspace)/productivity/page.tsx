import styles from "./productivity.module.css";

import { MenuHub } from "@/components/app/menu-hub";
import { hubSections } from "@/lib/menu-hub";
import { adminNavigation, filterNavigation, productivityNavigation } from "@/lib/navigation";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/server/auth";

/** Productivity menu (Office, Calendar, …, Email Blast). Also the phone entry to Admin pages. */
export default async function ProductivityMenuPage() {
  const user = await requireUser();
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(user.role_id, permission);
  // Admin's Settings group is flattened so each settings page is one tile.
  const admin = filterNavigation(adminNavigation, can).flatMap((item) => (item.children?.length ? item.children : [item]));
  const sections = [...hubSections("Productivity", filterNavigation(productivityNavigation, can)), ...(admin.length ? hubSections("Admin", admin) : [])];
  return (
    <div className={styles.page}>
      <MenuHub sections={sections} />
    </div>
  );
}
