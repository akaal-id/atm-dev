import { NotificationsView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function NotificationsPage() {
  const data = await getAppData();
  return <NotificationsView {...data} />;
}
