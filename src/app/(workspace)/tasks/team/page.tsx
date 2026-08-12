import styles from "./team.module.css";
import { TaskListView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function TeamTasksPage() {
  const data = await getAppData(["Users", "Projects", "Tasks"]);
  return (
    <div className={styles.page}>
      <TaskListView data={data} scope="team" />
    </div>
  );
}
