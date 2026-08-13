export const ATM_CONFIRM_PREFIX = "[ATM_CONFIRM]";

export const AI_MUTATION_TOOLS = [
  "createTask",
  "updateTask",
  "createChecklist",
  "createWorkflow",
  "updateWorkflow",
  "deleteWorkflow",
] as const;

export type AiMutationTool = (typeof AI_MUTATION_TOOLS)[number];

export type AiPriority = "Low" | "Medium" | "High" | "Urgent";

export type WorkflowOption = {
  workflow_id: string;
  name: string;
  project_id: string | null;
  project_name?: string;
};

export type WorkflowListItem = WorkflowOption & {
  column_names: string[];
};

export type TaskCreateDraft = {
  title: string;
  workflowId: string;
  workflowName: string;
  projectId: string;
  projectName: string;
  description: string;
  priority: AiPriority;
  due_date: string;
};

export type TaskUpdateDraft = {
  taskId: string;
  title: string;
  changes: Array<{ field: string; from: string; to: string }>;
  status?: string;
  nextTitle?: string;
  description?: string;
  priority?: AiPriority;
  due_date?: string;
  report?: string;
};

export type ChecklistCreateDraft = {
  taskId: string;
  taskTitle: string;
  title: string;
};

export type WorkflowCreateDraft = {
  name: string;
  description: string;
  projectId: string;
  projectName: string;
  preset: "akaal" | "creative" | "ops";
  presetLabel: string;
  column_names: string[];
  ticketPrefix: string;
  sprintStart: string;
  sprintEnd: string;
  backlogTitles: string[];
  customColumns?: string[];
};

export type WorkflowUpdateDraft = {
  workflowId: string;
  name: string;
  description: string;
};

export type WorkflowDeleteDraft = {
  workflowId: string;
  name: string;
  taskCount: number;
};

export type MutationPreview<T> = {
  kind: "preview";
  action: "create" | "update" | "delete";
  entity: "task" | "workflow" | "checklist";
  draft: T;
  warnings?: string[];
};

export type MutationResult<T> = {
  kind: "result";
  action: "create" | "update" | "delete";
  entity: "task" | "workflow" | "checklist";
  ok: boolean;
  record?: T;
  error?: string;
};

export type NeedsWorkflowResult = {
  kind: "needsWorkflow";
  message: string;
  title?: string;
  workflows: WorkflowOption[];
};

export function isAiMutationTool(value: string): value is AiMutationTool {
  return (AI_MUTATION_TOOLS as readonly string[]).includes(value);
}

export function formatConfirmPrompt(tool: AiMutationTool, args: Record<string, unknown>): string {
  return `${ATM_CONFIRM_PREFIX} ${tool}\n${JSON.stringify({ ...args, confirmed: true })}`;
}

export function confirmArgsFromDraft(tool: AiMutationTool, draft: Record<string, unknown>): Record<string, unknown> {
  switch (tool) {
    case "createTask":
      return {
        title: draft.title,
        workflowId: draft.workflowId,
        description: draft.description ?? "",
        priority: draft.priority ?? "Medium",
        due_date: draft.due_date ?? "",
      };
    case "updateTask":
      return {
        taskId: draft.taskId,
        title: draft.nextTitle,
        description: draft.description,
        priority: draft.priority,
        due_date: draft.due_date,
        status: draft.status,
        report: draft.report,
      };
    case "createChecklist":
      return { taskId: draft.taskId, title: draft.title };
    case "createWorkflow":
      return {
        name: draft.name,
        description: draft.description ?? "",
        projectId: draft.projectId || undefined,
        preset: draft.preset ?? "akaal",
        ticketPrefix: draft.ticketPrefix ?? "",
        sprintStart: draft.sprintStart ?? "",
        sprintEnd: draft.sprintEnd ?? "",
        backlogTitles: Array.isArray(draft.backlogTitles) ? draft.backlogTitles : [],
        customColumns: Array.isArray(draft.customColumns) ? draft.customColumns : undefined,
      };
    case "updateWorkflow":
      return {
        workflowId: draft.workflowId,
        name: draft.name,
        description: draft.description ?? "",
      };
    case "deleteWorkflow":
      return { workflowId: draft.workflowId };
  }
}
