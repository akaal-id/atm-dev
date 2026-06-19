import { notFound } from "next/navigation";

import { TaskDetailView } from "@/components/app/views";
import { getAppData } from "@/lib/server/app-data";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAppData(["Users", "Projects", "Tasks", "Task_Comments", "Task_Checklists", "Project_Files", "Activity_Logs"]);
  const task = data.tasks.find((candidate) => candidate.task_id === id);

  if (!task) notFound();

  return <TaskDetailView data={data} task={task} />;
}
