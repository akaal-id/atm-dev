import { DEFAULT_WORKFLOW_COLUMNS } from "@/lib/data/workflow-templates-mock";
import type { Workflow, WorkflowColumn } from "@/lib/types";

export function normalizeWorkflowColumns(columns: unknown): WorkflowColumn[] {
  if (!Array.isArray(columns)) {
    return DEFAULT_WORKFLOW_COLUMNS.map((column) => ({ ...column }));
  }

  return columns
    .map((column, order_index) => {
      const row = column as Partial<WorkflowColumn>;
      return {
        id: String(row.id ?? `col_${order_index}`),
        name: String(row.name ?? `Column ${order_index + 1}`),
        order_index: typeof row.order_index === "number" ? row.order_index : order_index,
        is_2stage_approval_trigger: Boolean(row.is_2stage_approval_trigger),
      };
    })
    .sort((left, right) => left.order_index - right.order_index);
}

export function normalizeWorkflow(workflow: Workflow): Workflow {
  const status = String(workflow.status ?? "Not Started").trim();
  return {
    ...workflow,
    status: status === "In Progress" || status === "Completed" ? status : "Not Started",
    project_id: workflow.project_id ?? "",
    company_id: workflow.company_id ?? "",
    columns: normalizeWorkflowColumns(workflow.columns),
  };
}
