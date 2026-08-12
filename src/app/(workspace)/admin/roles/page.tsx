import styles from "./roles.module.css";
import { RolesView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function AdminRolesPage() {
  await requirePermission("roles:manage");
  const data = await getAppData(["Roles"]);
  return (
    <div className={styles.page}>
      <RolesView {...data} />
    </div>
  );
}
