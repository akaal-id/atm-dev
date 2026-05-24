import { GamificationSettingsView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function AdminGamificationSettingsPage() {
  await requirePermission("settings:manage");
  const data = await getAppData(["Badges"]);
  return <GamificationSettingsView {...data} />;
}
