"use client";

import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EditTaskModal, type TaskModalProject, type TaskModalUser } from "@/components/app/create-task-modal";
import { Button } from "@/components/ui/button";
import { TaskConfirmModal } from "@/components/app/task-confirm-modal";
import { canApproveTaskAsLeader, hasPermission } from "@/lib/permissions";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";
import type { CurrentUser, Task, TaskChecklist } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskUpdatePanel({
  task,
  checklist,
  currentUser,
  users,
  projects,
}: {
  task: Task;
  checklist: TaskChecklist[];
  currentUser: CurrentUser;
  users: TaskModalUser[];
  projects: TaskModalProject[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const canEdit =
    hasPermission(currentUser.role_id, "tasks:manage") ||
    hasPermission(currentUser.role_id, "tasks:team") ||
    task.assigned_by === currentUser.user_id;
  const canDelete = hasPermission(currentUser.role_id, "tasks:manage") || task.assigned_by === currentUser.user_id;
  const canLeaderApprove = canApproveTaskAsLeader(currentUser);
  const canSubmitDone = canLeaderApprove || task.assigned_to.includes(currentUser.user_id);
  const needsLeaderApproval = taskNeedsLeaderApproval(task);
  const leaderApprovalComplete =
    !needsLeaderApproval || (checklist.length > 0 ? checklist.every((item) => item.pm_approved) : canLeaderApprove);
  const doneDisabled = needsLeaderApproval && !leaderApprovalComplete;

  const deleteTask = async () => {
    if (!canDelete || deleting) return;

    setDeleting(true);
    setError("");

    const formData = new FormData();
    formData.set("_method", "delete");

    const response = await fetch(`/api/resources/Tasks/${task.task_id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: formData,
    }).catch(() => null);

    setDeleting(false);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setError(payload?.error ? String(payload.error) : "Could not delete task.");
      return;
    }

    setDeleteConfirmOpen(false);
    router.push("/tasks/my");
    router.refresh();
  };

  return (
    <>
      {canEdit || canDelete ? (
        <div className="grid grid-cols-2 gap-2">
          {canEdit ? (
            <Button type="button" variant="outline" size="xl" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit task
            </Button>
          ) : (
            <span />
          )}
          {canDelete ? (
            <Button type="button" variant="destructiveOutline" size="xl" onClick={() => setDeleteConfirmOpen(true)} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
              {deleting ? "Deleting..." : "Delete task"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}

      {canSubmitDone && task.status !== "Finished" ? (
        <form action={`/api/tasks/${task.task_id}/done`} method="post">
          <Button type="submit" variant="success" size="xl" className="w-full" disabled={doneDisabled}>
            <CheckCircle2 className="h-4 w-4" />
            Submit Done
          </Button>
          {doneDisabled ? (
            <p className="mt-2 text-xs font-semibold text-amber-600">Leader approval is required before this task can be finished.</p>
          ) : null}
        </form>
      ) : null}

      {canEdit ? (
        <EditTaskModal
          task={task}
          currentUser={currentUser}
          users={users}
          projects={projects}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}

      <TaskConfirmModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete task?"
        description={`Delete "${task.title}"? This will remove the task, its checklists, and comments. This cannot be undone.`}
        confirmLabel="Delete task"
        onConfirm={deleteTask}
        confirming={deleting}
        tone="danger"
      />
    </>
  );
}
