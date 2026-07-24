import { WorkflowCreateForm } from "@/components/app/workflow/workflow-create-form";
import { getAppData } from "@/lib/server/app-data";

export default async function NewWorkflowPage() {
  const data = await getAppData(["Projects"]);
  const projects = data.projects.map((project) => ({
    project_id: project.project_id,
    project_name: project.project_name,
    ticket_id_prefix: project.ticket_id_prefix || "",
  }));

  return <WorkflowCreateForm projects={projects} />;
}
