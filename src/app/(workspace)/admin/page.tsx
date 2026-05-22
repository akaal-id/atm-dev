import { AdminView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function AdminPage() {
  await requirePermission("admin:view");
  const data = await getAppData();
  return <AdminView {...data} />;
}
