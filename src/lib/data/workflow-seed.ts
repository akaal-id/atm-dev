import { mockWorkflows } from "@/lib/data/workflow-templates-mock";
import type { Workflow } from "@/lib/types";

/** In-memory seed for non-Supabase modes; live data lives in public.workflows. */
export const seedWorkflows: Workflow[] = mockWorkflows.map((workflow) => ({
  workflow_id: workflow.workflow_id,
  name: workflow.name,
  description: workflow.description,
  status: workflow.status ?? "Not Started",
  project_id: workflow.project_id ?? "",
  company_id: "cmp_akaal",
  columns: workflow.columns,
  sprint_start: workflow.sprint_start ?? "",
  sprint_end: workflow.sprint_end ?? "",
  ticket_id_prefix: workflow.ticket_id_prefix ?? "",
  template_id: workflow.template_id ?? "",
  template_name: workflow.template_name ?? "",
  inherit_project_tasks: Boolean(workflow.inherit_project_tasks),
  created_at: workflow.updated_at,
  updated_at: workflow.updated_at,
}));
