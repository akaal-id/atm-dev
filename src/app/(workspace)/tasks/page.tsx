import { redirect } from "next/navigation";

/** "Tasks" (breadcrumb, sidebar group) has no page of its own: send people to their own tasks. */
export default function TasksIndexPage() {
  redirect("/tasks/my");
}
