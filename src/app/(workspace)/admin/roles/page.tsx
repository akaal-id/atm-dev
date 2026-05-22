import { RolesView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function AdminRolesPage() {
  await requirePermission("roles:manage");
  const data = await getAppData();
  return <RolesView {...data} />;
}
