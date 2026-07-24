"use client";

import { Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { TaskConfirmModal } from "@/components/app/task-confirm-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { ModalPortal } from "@/components/ui/modal-portal";
import { mockWorkflows } from "@/lib/data/workflow-templates-mock";
import { listLocalWorkflows } from "@/lib/data/workflow-local-store";
import { taskNeedsLeaderApproval, visibleTaskLabels } from "@/lib/task-approval";
import type { CurrentUser, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface TaskModalUser {
  user_id: string;
  full_name: string;
  is_active: boolean;
}

export interface TaskModalProject {
  project_id: string;
  project_name: string;
  ticket_id_prefix: string;
}

export interface TaskModalWorkflow {
  id: string;
  name: string;
  project_id: string | null;
}

type TaskFormModalProps = {
  mode: "create" | "edit";
  currentUser: CurrentUser;
  users: TaskModalUser[];
  projects: TaskModalProject[];
  workflows?: TaskModalWorkflow[];
  defaultWorkflowId?: string;
  task?: Task;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showSubtasks?: boolean;
};

function toWorkflowOptions(workflows: TaskModalWorkflow[]): TaskModalWorkflow[] {
  const seen = new Set<string>();
  const next: TaskModalWorkflow[] = [];
  for (const workflow of workflows) {
    if (seen.has(workflow.id)) continue;
    seen.add(workflow.id);
    next.push(workflow);
  }
  return next.sort((left, right) => left.name.localeCompare(right.name));
}

export function TaskFormModal({
  mode,
  currentUser,
  users,
  projects,
  workflows: workflowsProp = [],
  defaultWorkflowId = "",
  task,
  open: controlledOpen,
  onOpenChange,
  showSubtasks = mode === "create",
}: TaskFormModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [needLeaderApproval, setNeedLeaderApproval] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [localWorkflows, setLocalWorkflows] = useState<TaskModalWorkflow[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const activeUsers = users.filter((user) => user.is_active);
  const isEdit = mode === "edit" && task;

  const workflows = useMemo(() => {
    const seed =
      workflowsProp.length > 0
        ? workflowsProp
        : mockWorkflows.map((workflow) => ({
            id: workflow.workflow_id,
            name: workflow.name,
            project_id: workflow.project_id,
          }));
    return toWorkflowOptions([...localWorkflows, ...seed]);
  }, [localWorkflows, workflowsProp]);

  const workflowOptions = useMemo(() => {
    let list = projectId
      ? workflows.filter((workflow) => !workflow.project_id || workflow.project_id === projectId)
      : workflows;
    if (list.length === 0) list = workflows;
    if (workflowId && !list.some((workflow) => workflow.id === workflowId)) {
      const current = workflows.find((workflow) => workflow.id === workflowId);
      if (current) list = [current, ...list];
    }
    return [
      { value: "", label: "No workflow" },
      ...list.map((workflow) => ({
        value: workflow.id,
        label: workflow.name,
      })),
    ];
  }, [projectId, workflowId, workflows]);

  useEffect(() => {
    if (!open) return;
    const fromLocal = listLocalWorkflows().map((workflow) => ({
      id: workflow.workflow_id,
      name: workflow.name,
      project_id: workflow.project_id,
    }));
    setLocalWorkflows(fromLocal);

    if (isEdit) {
      setNeedLeaderApproval(taskNeedsLeaderApproval(task));
      setProjectId(task.project_id || "");
      setWorkflowId(task.workflow_id || "");
      return;
    }

    setNeedLeaderApproval(false);
    const seed =
      workflowsProp.length > 0
        ? workflowsProp
        : mockWorkflows.map((workflow) => ({
            id: workflow.workflow_id,
            name: workflow.name,
            project_id: workflow.project_id,
          }));
    const all = toWorkflowOptions([...fromLocal, ...seed]);
    const presetId = defaultWorkflowId || "";
    const preset = all.find((workflow) => workflow.id === presetId);
    setWorkflowId(presetId);
    setProjectId(preset?.project_id || "");
  }, [open, isEdit, task, defaultWorkflowId, workflowsProp]);

  if (!open) return null;

  const formAction = isEdit ? `/api/resources/Tasks/${task.task_id}` : "/api/resources/Tasks";
  const heading = isEdit ? "Edit task" : "Create task ticket";
  const submitLabel = isEdit ? "Save changes" : "Create ticket";
  const linkedProject = isEdit ? projects.find((project) => project.project_id === task.project_id) : undefined;
  const projectLabel = linkedProject
    ? `${linkedProject.ticket_id_prefix ? `${linkedProject.ticket_id_prefix} - ` : ""}${linkedProject.project_name}`
    : "No project";

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!isEdit) return;
    event.preventDefault();
    setConfirmSaveOpen(true);
  };

  const confirmSave = () => {
    setConfirmSaveOpen(false);
    formRef.current?.submit();
  };

  function onWorkflowChange(nextWorkflowId: string) {
    setWorkflowId(nextWorkflowId);
    if (isEdit) return;
    const selected = workflows.find((workflow) => workflow.id === nextWorkflowId);
    if (selected?.project_id) setProjectId(selected.project_id);
  }

  return (
    <>
      <ModalPortal>
        <div className="fixed inset-0 z-50 grid place-items-end bg-neutral-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2px] bg-card shadow-2xl sm:max-w-3xl sm:rounded-[2px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <div>
                <h2 className="text-lg font-normal tracking-normal text-foreground">{heading}</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label={isEdit ? "Close edit task" : "Close create task"}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form ref={formRef} action={formAction} method="post" className="space-y-5 p-5" onSubmit={handleFormSubmit}>
              {!isEdit ? <input type="hidden" name="assigned_by" value={currentUser.user_id} /> : null}
              <input type="hidden" name="need_leader_approval" value={String(needLeaderApproval)} />

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <input
                    name="title"
                    required
                    className="input"
                    placeholder="Single deliverable title"
                    defaultValue={isEdit ? task.title : undefined}
                  />
                </Field>
                <Field label="Due date">
                  <DatePickerField name="due_date" required variant="form" defaultValue={isEdit ? task.due_date : undefined} />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  name="description"
                  required
                  className="input min-h-24 resize-y"
                  placeholder="Brief, references, links, and expected output"
                  defaultValue={isEdit ? task.description : undefined}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                {isEdit ? (
                  <Field label="Project">
                    <div className="input flex min-h-11 items-center bg-surface-inset text-sm font-normal text-foreground">{projectLabel}</div>
                    <p className="text-xs font-normal text-muted-foreground">
                      Project cannot be changed because the ticket ID prefix is set at creation.
                    </p>
                  </Field>
                ) : (
                  <Field label="Project">
                    <FormSelect
                      name="project_id"
                      value={projectId}
                      onValueChange={setProjectId}
                      placeholder="No project"
                      options={[
                        { value: "", label: "No project" },
                        ...projects.map((project) => ({
                          value: project.project_id,
                          label: `${project.ticket_id_prefix ? `${project.ticket_id_prefix} - ` : ""}${project.project_name}`,
                        })),
                      ]}
                    />
                  </Field>
                )}
                <Field label="Workflow">
                  <FormSelect
                    name="workflow_id"
                    value={workflowId}
                    onValueChange={onWorkflowChange}
                    placeholder="No workflow"
                    options={workflowOptions}
                  />
                </Field>
              </div>

              <Field label="Priority">
                <FormSelect
                  name="priority"
                  defaultValue={isEdit ? task.priority : "Medium"}
                  options={["Low", "Medium", "High", "Urgent"].map((priority) => ({ value: priority, label: priority }))}
                />
              </Field>

              <Button
                type="button"
                variant="outline"
                aria-pressed={needLeaderApproval}
                onClick={() => setNeedLeaderApproval((current) => !current)}
                className={cn(
                  "h-auto w-full justify-between gap-3 p-4 text-left font-normal",
                  needLeaderApproval ? "border-primary/30 bg-primary-subtle text-primary hover:bg-primary-subtle" : "text-foreground",
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-[2px]",
                      needLeaderApproval ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-normal">Need Leader Approval</span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      Show Leader approval checkboxes for Manager, Admin, or Super Admin review.
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-normal",
                    needLeaderApproval ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {needLeaderApproval ? "On" : "Off"}
                </span>
              </Button>

              <Field label="Assignees">
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-[2px] border border-border bg-surface-inset p-2 sm:grid-cols-2">
                  {activeUsers.map((user) => {
                    const checked = isEdit
                      ? task.assigned_to.includes(user.user_id)
                      : user.user_id === currentUser.user_id;

                    return (
                      <label
                        key={user.user_id}
                        className={cn(
                          "flex min-w-0 items-center gap-2 rounded-[2px] border border-white bg-card px-3 py-2 text-sm font-normal text-foreground",
                          checked && "border-primary/30 bg-primary-subtle text-primary",
                        )}
                      >
                        <input
                          name="assigned_to"
                          type="checkbox"
                          defaultChecked={checked}
                          value={user.user_id}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="truncate">{user.full_name}</span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              {showSubtasks ? (
                <Field label="Subtasks">
                  <textarea
                    name="checklist_titles"
                    required
                    className="input min-h-28 resize-y"
                    placeholder={"Copywriting\nDesign\nStakeholder review"}
                  />
                </Field>
              ) : null}

              <Field label="Labels">
                <input
                  name="labels"
                  className="input"
                  placeholder="Design, Urgent, Client"
                  defaultValue={isEdit ? visibleTaskLabels(task.labels).join(", ") : undefined}
                />
              </Field>

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" size="xl" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="xl">
                  {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {submitLabel}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {isEdit ? (
        <TaskConfirmModal
          open={confirmSaveOpen}
          onOpenChange={setConfirmSaveOpen}
          title="Save task changes?"
          description={`Update "${task.title}" with the changes you made? Assignees and other task details will be updated.`}
          confirmLabel="Save changes"
          onConfirm={confirmSave}
        />
      ) : null}
    </>
  );
}

export function CreateTaskModal({
  currentUser,
  users,
  projects,
  workflows,
  defaultWorkflowId,
  title = "Create ticket",
  triggerVariant = "default",
  triggerClassName,
}: {
  currentUser: CurrentUser;
  users: TaskModalUser[];
  projects: TaskModalProject[];
  workflows?: TaskModalWorkflow[];
  defaultWorkflowId?: string;
  title?: string;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size="lg"
        className={cn("h-10 gap-2 px-3 font-normal", triggerClassName)}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {title}
      </Button>

      <TaskFormModal
        mode="create"
        currentUser={currentUser}
        users={users}
        projects={projects}
        workflows={workflows}
        defaultWorkflowId={defaultWorkflowId}
        open={open}
        onOpenChange={setOpen}
        showSubtasks
      />
    </>
  );
}

export function EditTaskModal({
  task,
  currentUser,
  users,
  projects,
  workflows,
  open,
  onOpenChange,
}: {
  task: Task;
  currentUser: CurrentUser;
  users: TaskModalUser[];
  projects: TaskModalProject[];
  workflows?: TaskModalWorkflow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <TaskFormModal
      mode="edit"
      task={task}
      currentUser={currentUser}
      users={users}
      projects={projects}
      workflows={workflows}
      open={open}
      onOpenChange={onOpenChange}
      showSubtasks={false}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-normal text-foreground">{label}</span>
      {children}
    </label>
  );
}
