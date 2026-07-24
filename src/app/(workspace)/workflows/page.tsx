import { WorkflowList } from "@/components/app/workflow/workflow-list";
import { getAppData } from "@/lib/server/app-data";
import { normalizeWorkflow } from "@/lib/workflow-normalize";

export default async function WorkflowsPage() {
  const data = await getAppData(["Projects", "Tasks", "Workflows"]);
  const workflows = data.workflows.map(normalizeWorkflow);

  return <WorkflowList workflows={workflows} tasks={data.tasks} projects={data.projects} />;
}
