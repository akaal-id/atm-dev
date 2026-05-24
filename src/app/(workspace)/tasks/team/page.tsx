import { TaskListView } from "@/components/app/views";
import { requirePermission } from "@/lib/server/auth";
import { getAppData } from "@/lib/server/app-data";

export default async function TeamTasksPage() {
  await requirePermission("tasks:team");
  const data = await getAppData(["Users", "Projects", "Tasks"]);
  return <TaskListView data={data} scope="team" />;
}
