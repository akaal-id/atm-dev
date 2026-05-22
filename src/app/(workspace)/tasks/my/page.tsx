import { TaskListView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function MyTasksPage() {
  const data = await getAppData();
  return <TaskListView data={data} scope="my" />;
}
