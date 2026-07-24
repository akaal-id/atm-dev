/** Browser-persisted workflows created from the frontend wizard (until API exists). */

import type { MockWorkflow, MockWorkflowColumn } from "@/lib/data/workflow-templates-mock";
import type { Priority, Task, TaskStatus } from "@/lib/types";

const STORAGE_KEY = "atm.local-workflows.v1";

export type LocalBacklogTask = {
  task_id: string;
  title: string;
  project_id: string;
  workflow_id: string;
  status: TaskStatus;
  priority: Priority;
  created_at: string;
  updated_at: string;
};

export type LocalWorkflowRecord = {
  workflow: MockWorkflow;
  backlog: LocalBacklogTask[];
};

type StoreShape = {
  records: LocalWorkflowRecord[];
};

function emptyStore(): StoreShape {
  return { records: [] };
}

function readStore(): StoreShape {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed || !Array.isArray(parsed.records)) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreShape) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listLocalWorkflowRecords(): LocalWorkflowRecord[] {
  return readStore().records;
}

export function listLocalWorkflows(): MockWorkflow[] {
  return listLocalWorkflowRecords().map((record) => record.workflow);
}

export function getLocalWorkflowRecord(id: string): LocalWorkflowRecord | null {
  return listLocalWorkflowRecords().find((record) => record.workflow.workflow_id === id) ?? null;
}

export function saveLocalWorkflowRecord(record: LocalWorkflowRecord) {
  const store = readStore();
  const index = store.records.findIndex((item) => item.workflow.workflow_id === record.workflow.workflow_id);
  if (index >= 0) store.records[index] = record;
  else store.records.unshift(record);
  writeStore(store);
}

export function localBacklogToTasks(backlog: LocalBacklogTask[]): Task[] {
  return backlog.map((item) => ({
    task_id: item.task_id,
    title: item.title,
    description: "",
    project_id: item.project_id,
    workflow_id: item.workflow_id,
    assigned_by: "",
    assigned_to: [],
    priority: item.priority,
    status: item.status,
    due_date: "",
    progress: item.status === "Finished" || item.status === "Done" ? 100 : 0,
    labels: [],
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

export function buildLocalBacklogTask(input: {
  title: string;
  workflowId: string;
  projectId: string;
  prefix: string;
  status: TaskStatus;
  index: number;
}): LocalBacklogTask {
  const now = new Date().toISOString();
  const prefix = (input.prefix || "WF").toUpperCase().slice(0, 5);
  return {
    task_id: `${prefix}-L${Date.now().toString(36).slice(-4)}${input.index}`.toUpperCase(),
    title: input.title,
    project_id: input.projectId,
    workflow_id: input.workflowId,
    status: input.status,
    priority: "Medium",
    created_at: now,
    updated_at: now,
  };
}

export function createLocalWorkflowDraft(input: {
  id: string;
  name: string;
  description: string;
  projectId: string | null;
  sprintStart: string | null;
  sprintEnd: string | null;
  ticketPrefix: string | null;
  columns: MockWorkflowColumn[];
  templateId: string | null;
  templateName: string | null;
}): MockWorkflow {
  return {
    workflow_id: input.id,
    name: input.name,
    description: input.description,
    project_id: input.projectId ?? "",
    columns: input.columns.map((column) => ({ ...column })),
    updated_at: new Date().toISOString(),
    sprint_start: input.sprintStart ?? "",
    sprint_end: input.sprintEnd ?? "",
    ticket_id_prefix: input.ticketPrefix ?? "",
    template_id: input.templateId ?? "",
    template_name: input.templateName ?? "",
    inherit_project_tasks: false,
  };
}

export function isLocalWorkflowId(id: string | null | undefined) {
  return Boolean(id?.startsWith("wf_local_"));
}

/** Update a locally stored backlog task status. Returns true when handled. */
export function updateLocalTaskStatus(taskId: string, status: TaskStatus): boolean {
  const store = readStore();
  let changed = false;
  for (const record of store.records) {
    const task = record.backlog.find((item) => item.task_id === taskId);
    if (!task) continue;
    task.status = status;
    task.updated_at = new Date().toISOString();
    record.workflow.updated_at = task.updated_at;
    changed = true;
    break;
  }
  if (changed) writeStore(store);
  return changed;
}

export function listAllLocalTasks(): Task[] {
  return listLocalWorkflowRecords().flatMap((record) => localBacklogToTasks(record.backlog));
}
