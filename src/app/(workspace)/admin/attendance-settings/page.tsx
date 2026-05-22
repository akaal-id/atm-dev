import { AttendanceSettingsView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function AdminAttendanceSettingsPage() {
  await requirePermission("settings:manage");
  const data = await getAppData();
  return <AttendanceSettingsView {...data} />;
}
