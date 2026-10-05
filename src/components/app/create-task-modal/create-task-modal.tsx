"use client";

import { Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { TaskConfirmModal } from "@/components/app/task-confirm-modal";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { ModalPortal } from "@/components/ui/modal-portal";
import { mockWorkflows } from "@/lib/data/workflow-templates-mock";
import { listLocalWorkflows } from "@/lib/data/workflow-local-store";
import { canManageTaskScoring } from "@/lib/permissions";
import { trackLabel } from "@/lib/scoring";
import { taskNeedsLeaderApproval, visibleTaskLabels } from "@/lib/task-approval";
import type { CurrentUser, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

import styles from "./create-task-modal.module.css";
import { useWorkTypes } from "./use-work-types";

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
  const canScore = canManageTaskScoring(currentUser);
  const scoring = useWorkTypes(open);
  const [workTypeId, setWorkTypeId] = useState("");
  const [picUserId, setPicUserId] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const selectedType = scoring?.workTypes.find((type) => type.id === workTypeId);

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
      setWorkTypeId(task.work_type_id || "");
      setPicUserId(task.pic_user_id || "");
      setAssignees(task.assigned_to);
      return;
    }

    setNeedLeaderApproval(false);
    setWorkTypeId("");
    setPicUserId("");
    setAssignees([currentUser.user_id]);
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
  }, [open, isEdit, task, defaultWorkflowId, workflowsProp, currentUser.user_id]);

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
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <div className={styles.header}>
              <div>
                <h2 className={styles.heading}>{heading}</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label={isEdit ? "Close edit task" : "Close create task"}
              >
                <X className={styles.icon} />
              </Button>
            </div>

            <form ref={formRef} action={formAction} method="post" className={styles.form} onSubmit={handleFormSubmit}>
              {!isEdit ? <input type="hidden" name="assigned_by" value={currentUser.user_id} /> : null}
              <input type="hidden" name="need_leader_approval" value={String(needLeaderApproval)} />

              <div className={styles.layout}>
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
                  className={cn("input", styles.textarea)}
                  placeholder="Brief, references, links, and expected output"
                  defaultValue={isEdit ? task.description : undefined}
                />
              </Field>

              <div className={styles.layout}>
                {isEdit ? (
                  <Field label="Project">
                    <div className={styles.readonlyValue}>{projectLabel}</div>
                    <p className={styles.hint}>
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

              <div className={styles.layout}>
                <Field label="Priority">
                  <FormSelect
                    name="priority"
                    defaultValue={isEdit ? task.priority : "Medium"}
                    options={["Low", "Medium", "High", "Urgent"].map((priority) => ({ value: priority, label: priority }))}
                  />
                </Field>
                <Field label="Work type">
                  <FormSelect
                    name="work_type_id"
                    value={workTypeId}
                    onValueChange={setWorkTypeId}
                    placeholder={scoring ? "Not set" : "Loading…"}
                    options={[
                      { value: "", label: "Not set" },
                      ...(scoring?.workTypes ?? []).map((type) => ({ value: type.id, label: `${trackLabel(type.track)} · ${type.name} (${type.effort} pts)` })),
                    ]}
                  />
                </Field>
              </div>

              {canScore ? (
                <div className={styles.layout}>
                  <Field label="Effort points">
                    <input
                      name="effort_points"
                      type="number"
                      min={0.5}
                      max={40}
                      step={0.5}
                      className="input"
                      placeholder={selectedType ? `${selectedType.effort} from work type` : `${scoring?.defaultEffort ?? 2} (default)`}
                      defaultValue={isEdit && task.effort_points ? String(task.effort_points) : undefined}
                    />
                    <p className={styles.hint}>Leave empty to use the work type&apos;s value.</p>
                  </Field>
                  <Field label="PIC (gets the larger share)">
                    <FormSelect
                      name="pic_user_id"
                      value={assignees.includes(picUserId) ? picUserId : ""}
                      onValueChange={setPicUserId}
                      placeholder={assignees.length > 1 ? "No PIC — split equally" : "Only assignee"}
                      options={[
                        { value: "", label: assignees.length > 1 ? "No PIC — split equally" : "Only assignee" },
                        ...activeUsers.filter((user) => assignees.includes(user.user_id)).map((user) => ({ value: user.user_id, label: user.full_name })),
                      ]}
                    />
                  </Field>
                </div>
              ) : null}

              <Button
                type="button"
                variant="outline"
                aria-pressed={needLeaderApproval}
                onClick={() => setNeedLeaderApproval((current) => !current)}
                className={cn(
                  styles.approvalToggle,
                  needLeaderApproval ? styles.approvalOn : styles.approvalOff,
                )}
              >
                <span className={styles.approvalRow}>
                  <span
                    className={cn(
                      styles.approvalIcon,
                      needLeaderApproval ? styles.approvalIconActive : undefined,
                    )}
                  >
                    <ShieldCheck className={styles.icon} />
                  </span>
                  <span className={styles.approvalCopy}>
                    <span className={styles.approvalTitle}>Need Leader Approval</span>
                    <span className={styles.approvalHint}>
                      Show Leader approval checkboxes for Manager, Admin, or Super Admin review.
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    styles.approvalBadge,
                    needLeaderApproval ? styles.approvalBadgeOn : undefined,
                  )}
                >
                  {needLeaderApproval ? "On" : "Off"}
                </span>
              </Button>

              <Field label="Assignees">
                <div className={styles.assigneeGrid}>
                  {activeUsers.map((user) => {
                    const checked = isEdit
                      ? task.assigned_to.includes(user.user_id)
                      : user.user_id === currentUser.user_id;

                    return (
                      <label
                        key={user.user_id}
                        className={cn(
                          styles.assignee,
                          checked && styles.assigneeChecked,
                        )}
                      >
                        <input
                          name="assigned_to"
                          type="checkbox"
                          defaultChecked={checked}
                          value={user.user_id}
                          className={styles.checkbox}
                          onChange={(event) =>
                            setAssignees((current) =>
                              event.target.checked ? [...new Set([...current, user.user_id])] : current.filter((id) => id !== user.user_id),
                            )
                          }
                        />
                        <span className={styles.assigneeName}>{user.full_name}</span>
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
                    className={cn("input", styles.subtasksField)}
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

              <div className={styles.actions}>
                <Button type="button" variant="outline" size="xl" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="xl">
                  {isEdit ? <Pencil className={styles.icon} /> : <Plus className={styles.icon} />}
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
  users: usersProp,
  projects: projectsProp,
  workflows: workflowsProp,
  defaultWorkflowId,
  title = "Create ticket",
  triggerVariant = "default",
  triggerClassName,
}: {
  currentUser: CurrentUser;
  users?: TaskModalUser[];
  projects?: TaskModalProject[];
  workflows?: TaskModalWorkflow[];
  defaultWorkflowId?: string;
  title?: string;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<TaskModalUser[]>(usersProp ?? []);
  const [projects, setProjects] = useState<TaskModalProject[]>(projectsProp ?? []);
  const [workflows, setWorkflows] = useState<TaskModalWorkflow[]>(workflowsProp ?? []);
  const [optionsLoading, setOptionsLoading] = useState(false);

  useEffect(() => {
    setUsers(usersProp ?? []);
  }, [usersProp]);

  useEffect(() => {
    setProjects(projectsProp ?? []);
  }, [projectsProp]);

  useEffect(() => {
    setWorkflows(workflowsProp ?? []);
  }, [workflowsProp]);

  useEffect(() => {
    if (!open) return;
    if ((usersProp?.length ?? 0) > 0 && (projectsProp?.length ?? 0) > 0) return;

    let cancelled = false;
    setOptionsLoading(true);

    void fetch("/api/tasks/create-options", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load create-task options");
        return (await response.json()) as {
          users?: TaskModalUser[];
          projects?: TaskModalProject[];
          workflows?: TaskModalWorkflow[];
        };
      })
      .then((payload) => {
        if (cancelled) return;
        setUsers(payload.users ?? []);
        setProjects(payload.projects ?? []);
        setWorkflows(payload.workflows ?? []);
      })
      .catch((error) => {
        console.error("create-task options failed", error);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, usersProp, projectsProp]);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size="lg"
        className={cn(styles.trigger, triggerClassName)}
        onClick={() => setOpen(true)}
        disabled={optionsLoading && open}
      >
        <Plus className={styles.icon} />
        <span className={styles.triggerLabel}>{title}</span>
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
    <label className={styles.labelField}>
      <span className={styles.field}>{label}</span>
      {children}
    </label>
  );
}
