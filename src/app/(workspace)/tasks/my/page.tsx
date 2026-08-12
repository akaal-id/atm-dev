import styles from "./my.module.css";
import { TaskListView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function MyTasksPage() {
  const data = await getAppData(["Users", "Projects", "Tasks"]);
  return (
    <div className={styles.page}>
      <TaskListView data={data} scope="my" />
    </div>
  );
}
