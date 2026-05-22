import { DashboardView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function DashboardPage() {
  const data = await getAppData();
  return <DashboardView {...data} />;
}
