/** Mock workflows + column templates — frontend-first stub until backend APIs land. */

import workflowTaskMap from "@/lib/data/workflow-task-map.json";
import type { Task, TaskStatus, Workflow, WorkflowColumn, WorkflowStatus } from "@/lib/types";

export type MockWorkflowColumn = WorkflowColumn;

export type MockWorkflowTemplate = {
  id: string;
  company_id: string;
  name: string;
  description: string;
  is_default: boolean;
  columns: MockWorkflowColumn[];
  project_count: number;
  updated_at: string;
};

/** @deprecated Prefer Workflow from @/lib/types — kept for template/board helpers. */
export type MockWorkflow = Omit<Workflow, "company_id" | "created_at" | "status"> & {
  company_id?: string;
  created_at?: string;
  status?: Workflow["status"];
  project_id: string | null;
};

export type WorkflowColumnSummary = {
  name: string;
  count: number;
  is_2stage_approval_trigger: boolean;
};

export type WorkflowTaskSummary = {
  total: number;
  done: number;
  progressPercent: number;
  status: WorkflowStatus;
  byColumn: WorkflowColumnSummary[];
};

const akaalColumns: MockWorkflowColumn[] = [
  { id: "wfc_todo", name: "To Do", order_index: 0, is_2stage_approval_trigger: false },
  { id: "wfc_progress", name: "In Progress", order_index: 1, is_2stage_approval_trigger: false },
  { id: "wfc_waiting", name: "Waiting Approval", order_index: 2, is_2stage_approval_trigger: true },
  { id: "wfc_ready", name: "Ready", order_index: 3, is_2stage_approval_trigger: false },
  { id: "wfc_finished", name: "Finished", order_index: 4, is_2stage_approval_trigger: false },
];

const creativeColumns: MockWorkflowColumn[] = [
  { id: "wfc_cs_brief", name: "Brief", order_index: 0, is_2stage_approval_trigger: false },
  { id: "wfc_cs_draft", name: "Drafting", order_index: 1, is_2stage_approval_trigger: false },
  { id: "wfc_cs_review", name: "Review", order_index: 2, is_2stage_approval_trigger: true },
  { id: "wfc_cs_done", name: "Published", order_index: 3, is_2stage_approval_trigger: false },
];

const opsColumns: MockWorkflowColumn[] = [
  { id: "wfc_ops_open", name: "Open", order_index: 0, is_2stage_approval_trigger: false },
  { id: "wfc_ops_doing", name: "Doing", order_index: 1, is_2stage_approval_trigger: false },
  { id: "wfc_ops_done", name: "Done", order_index: 2, is_2stage_approval_trigger: false },
];

export const DEFAULT_WORKFLOW_COLUMNS: MockWorkflowColumn[] = akaalColumns.map((column) => ({ ...column }));

/** Column presets (still used by create-project dropdown / admin stubs). */
export const mockWorkflowTemplates: MockWorkflowTemplate[] = [
  {
    id: "wft_default_akaal",
    company_id: "cmp_akaal",
    name: "Akaal Standard",
    description: "Default board matching the classic Akaal statuses, including 2-stage approval.",
    is_default: true,
    project_count: 12,
    updated_at: "2026-07-20T08:00:00.000Z",
    columns: akaalColumns,
  },
  {
    id: "wft_creative_sprint",
    company_id: "cmp_akaal",
    name: "Creative Sprint",
    description: "Shorter flow for design and content delivery with a single review gate.",
    is_default: false,
    project_count: 3,
    updated_at: "2026-07-18T11:30:00.000Z",
    columns: creativeColumns,
  },
  {
    id: "wft_ops_simple",
    company_id: "cmp_akaal",
    name: "Ops Simple",
    description: "Three-column board for light operational tickets without approval.",
    is_default: false,
    project_count: 1,
    updated_at: "2026-07-10T04:15:00.000Z",
    columns: opsColumns,
  },
];

export const mockWorkflows: MockWorkflow[] = [
  {
    workflow_id: "wf_hei_sosmed",
    name: "HEI Sosmed and others",
    description: "Halal Expo Indonesia — social content and non-website delivery.",
    project_id: "prj_c42905a8",
    columns: akaalColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_hei_website",
    name: "HEI Website",
    description: "Halal Expo Indonesia — website, portal, and registration web work.",
    project_id: "prj_c42905a8",
    columns: akaalColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_akaal_labs_website",
    name: "Akaal Labs Website",
    description: "Akaal.com website / CMS / portfolio FE work from Labs.",
    project_id: "prj_9dcd3c71",
    columns: akaalColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_akaal_labs_content",
    name: "Akaal Labs Content",
    description: "Labs marketing content and social copy.",
    project_id: "prj_9dcd3c71",
    columns: creativeColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_akaal_labs_product",
    name: "Akaal Labs Product",
    description: "ATM / product engineering tasks from Labs.",
    project_id: "prj_9dcd3c71",
    columns: akaalColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_akaal_labs_misc",
    name: "Akaal Labs Misc",
    description: "Labs test tickets and uncategorized items.",
    project_id: "prj_9dcd3c71",
    columns: opsColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_akaal_studio_content",
    name: "Akaal Studio Content",
    description: "Studio visual content and brand storytelling posts.",
    project_id: "prj_b3e857e9",
    columns: creativeColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_akaal_creative_portfolio",
    name: "Akaal Creative Portfolio",
    description: "Creative portfolio, web assets, decks, and pricelist.",
    project_id: "prj_f6e94f46",
    columns: creativeColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_akaal_creative_content",
    name: "Akaal Creative Content",
    description: "Creative social content and carousels.",
    project_id: "prj_f6e94f46",
    columns: creativeColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_akaal_id_offering",
    name: "AKAAL-ID Offering Decks",
    description: "Pitch research and client offering decks.",
    project_id: "prj_33d5fb6f",
    columns: akaalColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_bfriends_web",
    name: "BFriends Website",
    description: "BLife BFriends website updates.",
    project_id: "prj_93b29f9d",
    columns: akaalColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_bnesta_web",
    name: "BNesta Website",
    description: "BLife BNesta website updates.",
    project_id: "prj_2698319f",
    columns: akaalColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
  {
    workflow_id: "wf_selatox_web",
    name: "Selatox Website",
    description: "Selatox Bio Pharma frontend / website finishing.",
    project_id: "prj_14ed2750",
    columns: akaalColumns,
    updated_at: "2026-07-24T00:00:00.000Z",
  },
];

/** Explicit task → workflow map for all live tasks (regenerate via scripts/build-workflow-task-map.mjs). */
export const mockTaskWorkflowIds: Record<string, string> = {
  ...(workflowTaskMap as Record<string, string>),
};

export function getMockWorkflow(id?: string | null): MockWorkflow | null {
  if (!id) return null;
  return mockWorkflows.find((workflow) => workflow.workflow_id === id) ?? null;
}

export function getMockWorkflowTemplate(id?: string | null): MockWorkflowTemplate {
  if (id) {
    const found = mockWorkflowTemplates.find((template) => template.id === id);
    if (found) return found;
  }
  return mockWorkflowTemplates.find((template) => template.is_default) ?? mockWorkflowTemplates[0];
}

/** Resolve board columns from a workflow id or legacy template id. */
export function getMockBoardSource(id?: string | null): {
  id: string;
  name: string;
  columns: MockWorkflowColumn[];
} {
  const workflow = getMockWorkflow(id);
  if (workflow) {
    return { id: workflow.workflow_id, name: workflow.name, columns: workflow.columns };
  }
  const template = getMockWorkflowTemplate(id);
  return { id: template.id, name: template.name, columns: template.columns };
}

/** Stable demo assignment: project filter → template (legacy board preview). */
export function mockTemplateIdForProject(projectId: string): string {
  if (!projectId || projectId === "all" || projectId === "__no_project") {
    return getMockWorkflowTemplate().id;
  }
  // Prefer a website board when several workflows share the same project.
  const linked = mockWorkflows.filter((workflow) => workflow.project_id === projectId);
  const website = linked.find((workflow) => /website/i.test(workflow.name));
  if (website) return website.workflow_id;
  if (linked[0]) return linked[0].workflow_id;
  let hash = 0;
  for (let i = 0; i < projectId.length; i += 1) {
    hash = (hash + projectId.charCodeAt(i) * (i + 1)) % 997;
  }
  return mockWorkflowTemplates[hash % mockWorkflowTemplates.length].id;
}

export function sortedMockColumns(source: { columns: MockWorkflowColumn[] }): MockWorkflowColumn[] {
  return [...source.columns].sort((left, right) => left.order_index - right.order_index);
}

export function tasksForWorkflow(
  workflow: Pick<Workflow, "workflow_id" | "project_id" | "inherit_project_tasks"> | MockWorkflow,
  tasks: Task[],
): Task[] {
  return tasks.filter((task) => {
    if (task.workflow_id === workflow.workflow_id) return true;

    const mapped = mockTaskWorkflowIds[task.task_id];
    if (mapped) return mapped === workflow.workflow_id;

    if (workflow.inherit_project_tasks && workflow.project_id && task.project_id === workflow.project_id) {
      return true;
    }
    return false;
  });
}

export function summarizeWorkflowTasks(
  workflow: (Pick<Workflow, "workflow_id" | "project_id" | "inherit_project_tasks" | "columns"> | MockWorkflow),
  tasks: Task[],
): WorkflowTaskSummary {
  const scoped = tasksForWorkflow(workflow, tasks);
  const columns = sortedMockColumns(workflow);
  const byColumn = columns.map((column) => ({
    name: column.name,
    count: 0,
    is_2stage_approval_trigger: column.is_2stage_approval_trigger,
  }));
  const counts = new Map(byColumn.map((item) => [item.name, item]));
  const firstLane = columns.length > 0 ? columns[0].name : "";
  const doneLane = columns.length > 0 ? columns[columns.length - 1].name : "";
  let done = 0;
  let started = 0;

  for (const task of scoped) {
    const lane = mapTaskStatusToLane(task.status, columns);
    const bucket = counts.get(lane);
    if (bucket) bucket.count += 1;

    const isDone =
      lane === doneLane ||
      task.status === "Finished" ||
      task.status === "Done" ||
      task.status === "Approved";

    if (isDone) {
      done += 1;
      started += 1;
      continue;
    }

    if (lane !== firstLane) started += 1;
  }

  const total = scoped.length;
  const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);
  const status = deriveWorkflowStatusFromCounts(total, done, started);

  return { total, done, progressPercent, status, byColumn };
}

/** Workflow board status from its tasks — not a manually set field. */
export function deriveWorkflowStatus(
  workflow: Pick<Workflow, "workflow_id" | "project_id" | "inherit_project_tasks" | "columns"> | MockWorkflow,
  tasks: Task[],
): WorkflowStatus {
  return summarizeWorkflowTasks(workflow, tasks).status;
}

function deriveWorkflowStatusFromCounts(total: number, done: number, started: number): WorkflowStatus {
  if (total === 0 || started === 0) return "Not Started";
  if (done === total) return "Completed";
  return "In Progress";
}

/** Map stored task status onto a template column name for board grouping. */
export function mapTaskStatusToLane(status: string, columns: MockWorkflowColumn[]): string {
  const sorted = [...columns].sort((left, right) => left.order_index - right.order_index);
  if (sorted.length === 0) return status;

  const exact = sorted.find((column) => column.name === status);
  if (exact) return exact.name;

  const approval = sorted.find((column) => column.is_2stage_approval_trigger);
  const first = sorted[0];
  const second = sorted[1] ?? first;
  const last = sorted[sorted.length - 1];
  const beforeLast = sorted.length > 1 ? sorted[sorted.length - 2] : last;

  switch (status) {
    case "Finished":
    case "Done":
    case "Approved":
      return last.name;
    case "Ready":
      return beforeLast.name;
    case "Waiting Approval":
      return approval?.name ?? beforeLast.name;
    case "In Progress":
    case "Need Revision":
      return second.name;
    default:
      return first.name;
  }
}

/** Map a board lane back to a classic TaskStatus for the existing Tasks API. */
export function mapLaneToTaskStatus(laneName: string, columns: MockWorkflowColumn[]): TaskStatus {
  const sorted = [...columns].sort((left, right) => left.order_index - right.order_index);
  if (sorted.length === 0) return "To Do";

  const index = sorted.findIndex((column) => column.name === laneName);
  const column = index >= 0 ? sorted[index] : sorted[0];
  const approval = sorted.find((item) => item.is_2stage_approval_trigger);
  const last = sorted[sorted.length - 1];
  const beforeLast = sorted.length > 1 ? sorted[sorted.length - 2] : last;

  if (column.id === last.id || column.name === "Finished" || column.name === "Done" || column.name === "Published") {
    return "Finished";
  }
  if (approval && column.id === approval.id) return "Waiting Approval";
  if (column.id === beforeLast.id || column.name === "Ready") return "Ready";
  if (index <= 0 || column.name === "To Do" || column.name === "Open" || column.name === "Brief") return "To Do";
  return "In Progress";
}

export function isDoneLane(laneName: string, columns: MockWorkflowColumn[]): boolean {
  const sorted = [...columns].sort((left, right) => left.order_index - right.order_index);
  const last = sorted[sorted.length - 1];
  return Boolean(last && last.name === laneName);
}
