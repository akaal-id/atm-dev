import { DepartmentsManagerView, SettingsView, StatusCatalogView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function AdminSettingsPage() {
  await requirePermission("settings:manage");
  const data = await getAppData();
  return (
    <div className="space-y-5">
      <SettingsView {...data} />
      <DepartmentsManagerView {...data} />
      <StatusCatalogView />
    </div>
  );
}
