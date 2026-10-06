import styles from "./new.module.css";
import { WorkflowCreateForm } from "@/components/app/workflow/workflow-create-form";
import { getAppData } from "@/lib/server/app-data";

export default async function NewWorkflowPage() {
  const data = await getAppData(["Projects", "Users"]);
  const projects = data.projects.map((project) => ({
    project_id: project.project_id,
    project_name: project.project_name,
    ticket_id_prefix: project.ticket_id_prefix || "",
  }));

  const users = data.users.filter((user) => user.is_active).map((user) => ({ user_id: user.user_id, full_name: user.full_name }));

  return (
    <div className={styles.page}>
      <WorkflowCreateForm projects={projects} users={users} />
    </div>
  );
}
