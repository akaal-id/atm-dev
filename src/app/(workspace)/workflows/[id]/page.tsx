import { WorkflowDetailClient } from "@/components/app/workflow/workflow-detail-client";
import { DEFAULT_WORKFLOW_COLUMNS, tasksForWorkflow } from "@/lib/data/workflow-templates-mock";
import { getAppData } from "@/lib/server/app-data";
import { normalizeWorkflow } from "@/lib/workflow-normalize";
import type { Workflow } from "@/lib/types";

function resolveWorkflow(workflows: Workflow[], workflowId: string): Workflow {
  const existing = workflows.find((item) => item.workflow_id === workflowId);
  if (existing) return normalizeWorkflow(existing);
  return {
    workflow_id: workflowId,
    name: "Workflow",
    description: "Workflow not found.",
    status: "Not Started",
    project_id: "",
    company_id: "",
    columns: DEFAULT_WORKFLOW_COLUMNS.map((column) => ({ ...column })),
    created_at: "",
    updated_at: "",
  };
}

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAppData(["Users", "Projects", "Tasks", "Task_Checklists", "Workflows"]);
  const allWorkflows = data.workflows ?? [];
  const workflow = resolveWorkflow(allWorkflows, id);
  const tasks = tasksForWorkflow(workflow, data.tasks ?? []);

  return (
    <WorkflowDetailClient
      workflow={workflow}
      tasks={tasks}
      users={data.users ?? []}
      projects={data.projects ?? []}
      checklists={data.checklists ?? []}
      currentUser={data.currentUser}
      workflows={allWorkflows.map((item) => ({
        id: item.workflow_id,
        name: item.name,
        project_id: item.project_id || null,
      }))}
    />
  );
}
