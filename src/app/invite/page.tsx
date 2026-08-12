import styles from "./invite.module.css";
import { AppShell } from "@/components/app/app-shell";
import { InviteView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function InvitePage() {
  await requirePermission("employees:manage");
  const data = await getAppData(["Departments", "Roles"]);
  return (
    <div className={styles.page}>
      <AppShell>
      <InviteView {...data} />
    </AppShell>
    </div>
  );
}
