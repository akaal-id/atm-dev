import styles from "./settings.module.css";
import { EmailBlastAccountSettingsView } from "@/components/app/email-blast/email-blast-account-settings-view";
import { requireUser } from "@/lib/server/auth";

export default async function EmailBlastAccountSettingsPage() {
  const user = await requireUser();
  return (
    <div className={styles.page}>
      <EmailBlastAccountSettingsView user={user} />
    </div>
  );
}
