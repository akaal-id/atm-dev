"use client";

import styles from "./workflow-checklist-item.module.css";

import { Check, CheckCircle2, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import { TaskConfirmModal } from "@/components/app/task-confirm-modal";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { canApproveTaskAsLeader, hasPermission } from "@/lib/permissions";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";
import type { CurrentUser, Task, TaskChecklist } from "@/lib/types";
import { cn } from "@/lib/utils";

function ChecklistToggle({
  checked,
  disabled,
  label,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        styles.button,
        checked ? styles.checklisttoggle : styles.control,
      )}
    >
      <span
        className={cn(
          styles.caption,
          checked ? styles.captionSpan : styles.captionPrimary,
        )}
      >
        {checked ? <Check className={styles.icon} aria-hidden="true" /> : null}
      </span>
      {label}
    </Button>
  );
}

export function WorkflowChecklistItem({
  item,
  task,
  currentUser,
}: {
  item: TaskChecklist;
  task: Task;
  currentUser: CurrentUser;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // Local state for checkboxes to prevent page reloads
  const [localAssigneeDone, setLocalAssigneeDone] = useState(item.assignee_completed || item.is_completed);
  const [localPmApproved, setLocalPmApproved] = useState(item.pm_approved);

  useEffect(() => {
    setLocalAssigneeDone(item.assignee_completed || item.is_completed);
    setLocalPmApproved(item.pm_approved);
  }, [item]);

  const canManageTask = hasPermission(currentUser.role_id, "tasks:manage") || hasPermission(currentUser.role_id, "tasks:team");
  const canLeaderApprove = canApproveTaskAsLeader(currentUser);
  const isAssignee = task.assigned_to.includes(currentUser.user_id);
  const canEditItem = canManageTask || isAssignee;
  const needsLeaderApproval = taskNeedsLeaderApproval(task);

  const assigneeDone = localAssigneeDone;
  const pmApproved = localPmApproved;
  const itemComplete = assigneeDone && (!needsLeaderApproval || pmApproved);
  const itemStatus = needsLeaderApproval
    ? pmApproved
      ? "Ready"
      : assigneeDone
        ? "Waiting Approval"
        : "To Do"
    : assigneeDone
      ? "Ready"
      : "To Do";

  const handleToggleAssignee = async () => {
    if (saving || deleting) return;
    const nextVal = !assigneeDone;
    setLocalAssigneeDone(nextVal);
    try {
      const formData = new FormData();
      formData.set("assignee_completed", String(nextVal));
      const response = await fetch(`/api/resources/Task_Checklists/${item.checklist_id}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: formData,
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch (e) {
      setLocalAssigneeDone(!nextVal);
    }
  };

  const handleToggleLeader = async () => {
    if (saving || deleting) return;
    const nextVal = !pmApproved;
    setLocalPmApproved(nextVal);
    const originalAssigneeDone = assigneeDone;
    if (nextVal && !assigneeDone) {
      setLocalAssigneeDone(true);
    }
    try {
      const formData = new FormData();
      formData.set("pm_approved", String(nextVal));
      if (nextVal && !assigneeDone) {
        formData.set("assignee_completed", "true");
      }
      const response = await fetch(`/api/resources/Task_Checklists/${item.checklist_id}`, {
        method: "POST",
        headers: { accept: "application/json" },
        body: formData,
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch (e) {
      setLocalPmApproved(!nextVal);
      if (nextVal && !originalAssigneeDone) {
        setLocalAssigneeDone(false);
      }
    }
  };

  const requestSave = () => {
    const nextTitle = title.trim();
    if (!canEditItem || saving || !nextTitle) return;
    if (nextTitle === item.title) {
      setEditing(false);
      setError("");
      return;
    }
    setSaveConfirmOpen(true);
  };

  const saveTitle = async () => {
    const nextTitle = title.trim();
    if (!canEditItem || saving || !nextTitle) return;

    setSaving(true);
    setError("");

    const formData = new FormData();
    formData.set("title", nextTitle);

    const response = await fetch(`/api/resources/Task_Checklists/${item.checklist_id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: formData,
    }).catch(() => null);

    setSaving(false);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setError(payload?.error ? String(payload.error) : "Could not save subtask.");
      return;
    }

    setSaveConfirmOpen(false);
    setEditing(false);
    router.refresh();
  };

  const deleteItem = async () => {
    if (!canEditItem || deleting) return;

    setDeleting(true);
    setError("");

    const formData = new FormData();
    formData.set("_method", "delete");

    const response = await fetch(`/api/resources/Task_Checklists/${item.checklist_id}`, {
      method: "POST",
      headers: { accept: "application/json" },
      body: formData,
    }).catch(() => null);

    setDeleting(false);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);
      setError(payload?.error ? String(payload.error) : "Could not delete subtask.");
      return;
    }

    setDeleteConfirmOpen(false);
    router.refresh();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.group}>
        <div className={styles.content}>
          {editing ? (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={cn("input", styles.input)}
              autoFocus
            />
          ) : (
            <p className={cn(styles.itemDescription, itemComplete ? styles.text : styles.textP)}>{item.title}</p>
          )}
          <p className={styles.textPrimary}>
            Assignee {assigneeDone ? "done" : "open"}
            {needsLeaderApproval ? <> · Leader {pmApproved ? "approved" : "pending"}</> : null}
          </p>
        </div>
        <div className={styles.glyph}>
          {canEditItem ? (
            editing ? (
              <>
                <Button type="button" size="sm" className={styles.rowButton} onClick={requestSave} disabled={saving || !title.trim()}>
                  <CheckCircle2 className={styles.iconPrimary} />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={styles.rowButton}
                  onClick={() => {
                    setTitle(item.title);
                    setEditing(false);
                    setError("");
                  }}
                >
                  <X className={styles.iconPrimary} />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" size="icon-sm" aria-label="Edit subtask" onClick={() => setEditing(true)}>
                  <Pencil className={styles.iconPrimary} />
                </Button>
                <Button type="button" variant="destructiveOutline" size="icon-sm" aria-label="Delete subtask" onClick={() => setDeleteConfirmOpen(true)} disabled={deleting}>
                  <Trash2 className={styles.iconPrimary} />
                </Button>
              </>
            )
          ) : null}
          <StatusPill status={itemStatus} />
        </div>
      </div>
      {error ? <p className={styles.deleteSubtask}>{error}</p> : null}
      <div className={styles.region}>
        <ChecklistToggle checked={assigneeDone} disabled={!canEditItem} label="Assignee" onClick={handleToggleAssignee} />
        {needsLeaderApproval ? (
          <ChecklistToggle checked={pmApproved} disabled={!canLeaderApprove || !assigneeDone} label="Leader" onClick={handleToggleLeader} />
        ) : null}
      </div>

      <TaskConfirmModal
        open={saveConfirmOpen}
        onOpenChange={setSaveConfirmOpen}
        title="Save subtask changes?"
        description={`Update this subtask title to "${title.trim()}"?`}
        confirmLabel="Save changes"
        onConfirm={saveTitle}
        confirming={saving}
      />

      <TaskConfirmModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete subtask?"
        description={`Delete "${item.title}"? This cannot be undone.`}
        confirmLabel="Delete subtask"
        onConfirm={deleteItem}
        confirming={deleting}
        tone="danger"
      />
    </div>
  );
}
