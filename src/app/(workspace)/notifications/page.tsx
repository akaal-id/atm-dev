import { NotificationsView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";
import { listResourceByField } from "@/lib/server/store";

export default async function NotificationsPage() {
  const data = await getAppData([]);
  data.notifications = await listResourceByField("Notifications", "user_id", data.currentUser.user_id, {
    orderBy: "created_at",
  });

  return <NotificationsView {...data} />;
}
