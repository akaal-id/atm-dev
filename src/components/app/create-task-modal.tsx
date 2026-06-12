"use client";

import { Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { TaskConfirmModal } from "@/components/app/task-confirm-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { ModalPortal } from "@/components/ui/modal-portal";
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

type TaskFormModalProps = {
  mode: "create" | "edit";
  currentUser: CurrentUser;
  users: TaskModalUser[];
  projects: TaskModalProject[];
  task?: Task;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showSubtasks?: boolean;
};

export function TaskFormModal({
  mode,
  currentUser,
  users,
  projects,
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
  const formRef = useRef<HTMLFormElement>(null);
  const activeUsers = users.filter((user) => user.is_active);
  const isEdit = mode === "edit" && task;

  useEffect(() => {
    if (!open || !isEdit) return;
    setNeedLeaderApproval(taskNeedsLeaderApproval(task));
  }, [open, isEdit, task]);

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

  return (
    <>
    <ModalPortal>
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">{heading}</h2>
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
                <div className="input flex min-h-11 items-center bg-slate-50 text-sm font-semibold text-slate-700">{projectLabel}</div>
                <p className="text-xs font-medium text-slate-500">Project cannot be changed because the ticket ID prefix is set at creation.</p>
              </Field>
            ) : (
              <Field label="Project">
                <FormSelect
                  name="project_id"
                  defaultValue=""
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
            <Field label="Priority">
              <FormSelect
                name="priority"
                defaultValue={isEdit ? task.priority : "Medium"}
                options={["Low", "Medium", "High", "Urgent"].map((priority) => ({ value: priority, label: priority }))}
              />
            </Field>
          </div>

          <Button
            type="button"
            variant="outline"
            aria-pressed={needLeaderApproval}
            onClick={() => setNeedLeaderApproval((current) => !current)}
            className={cn(
              "h-auto w-full justify-between gap-3 p-4 text-left font-normal",
              needLeaderApproval ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50" : "text-slate-700",
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className={cn("grid h-9 w-9 place-items-center rounded-lg", needLeaderApproval ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Need Leader Approval</span>
                <span className="mt-1 block text-xs font-medium text-slate-500">Show Leader approval checkboxes for Manager, Admin, or Super Admin review.</span>
              </span>
            </span>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", needLeaderApproval ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>
              {needLeaderApproval ? "On" : "Off"}
            </span>
          </Button>

          <Field label="Assignees">
            <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
              {activeUsers.map((user) => {
                const checked = isEdit
                  ? task.assigned_to.includes(user.user_id)
                  : user.user_id === currentUser.user_id;

                return (
                  <label
                    key={user.user_id}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-lg border border-white bg-white px-3 py-2 text-sm font-semibold text-slate-700",
                      checked && "border-blue-200 bg-blue-50 text-blue-700",
                    )}
                  >
                    <input name="assigned_to" type="checkbox" defaultChecked={checked} value={user.user_id} className="h-4 w-4 accent-slate-950" />
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

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
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
  title = "Create ticket",
  triggerVariant = "default",
  triggerClassName,
}: {
  currentUser: CurrentUser;
  users: TaskModalUser[];
  projects: TaskModalProject[];
  title?: string;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant={triggerVariant} size="lg" className={cn("h-10 gap-2 px-3 font-semibold", triggerClassName)} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {title}
      </Button>

      <TaskFormModal
        mode="create"
        currentUser={currentUser}
        users={users}
        projects={projects}
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
  open,
  onOpenChange,
}: {
  task: Task;
  currentUser: CurrentUser;
  users: TaskModalUser[];
  projects: TaskModalProject[];
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
      open={open}
      onOpenChange={onOpenChange}
      showSubtasks={false}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
