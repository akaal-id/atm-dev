import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/server/api";
import { listResource } from "@/lib/server/store";

/** The signed-in user's tasks to pick from in the clock-out EOD summary (open first, newest activity first). */
export async function GET() {
  const access = await requireApiPermission("attendance:own");
  if ("error" in access) return access.error;

  const [tasks, projects] = await Promise.all([listResource("Tasks"), listResource("Projects")]);
  const projectName = new Map(projects.map((project) => [project.project_id, project.project_name]));
  const mine = tasks
    .filter((task) => task.assigned_to.includes(access.user.user_id) && task.status !== "Cancelled")
    .sort((left, right) => Number(left.status === "Finished") - Number(right.status === "Finished") || String(right.updated_at).localeCompare(String(left.updated_at)))
    .slice(0, 40)
    .map((task) => ({ task_id: task.task_id, title: task.title, status: task.status, project: projectName.get(task.project_id) ?? "" }));
  return NextResponse.json({ data: mine });
}
