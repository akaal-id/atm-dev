import { EmailBlastAccountSettingsView } from "@/components/app/email-blast/email-blast-account-settings-view";
import { requireUser } from "@/lib/server/auth";

export default async function EmailBlastAccountSettingsPage() {
  const user = await requireUser();
  return <EmailBlastAccountSettingsView user={user} />;
}
