"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useToast } from "@/components/ui/toast";
import type { Workflow } from "@/lib/types";

type WorkflowEditModalProps = {
  workflow: Pick<Workflow, "workflow_id" | "name" | "description">;
};

export function WorkflowEditModal({ workflow }: WorkflowEditModalProps) {
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description || "");

  const requiredDeletePhrase = `delete ${workflow.name}`;
  const canConfirmDelete = deletePhrase.trim() === requiredDeletePhrase;

  function openModal() {
    setName(workflow.name);
    setDescription(workflow.description || "");
    setConfirmDelete(false);
    setDeletePhrase("");
    setOpen(true);
  }

  function closeModal() {
    if (saving || deleting) return;
    setOpen(false);
    setConfirmDelete(false);
    setDeletePhrase("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || saving || deleting) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/resources/Workflows/${workflow.workflow_id}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: nextName,
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to update workflow");
      }

      pushToast({
        tone: "success",
        title: "Workflow updated",
        description: `Saved “${nextName}”.`,
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Could not update workflow",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!canConfirmDelete || deleting || saving) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/resources/Workflows/${workflow.workflow_id}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to delete workflow");
      }

      pushToast({
        tone: "success",
        title: "Workflow deleted",
        description: `“${workflow.name}” was removed.`,
      });
      setOpen(false);
      router.push(tenant.href("/workflows"));
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Could not delete workflow",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
      setDeleting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="lg" className="h-10 gap-2 px-3 font-normal" onClick={openModal}>
        <Pencil className="h-4 w-4" aria-hidden />
        Edit
      </Button>

      {open ? (
        <ModalPortal>
          <div className="fixed inset-0 z-50 grid place-items-end bg-neutral-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
            <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2px] bg-card shadow-2xl sm:max-w-lg sm:rounded-[2px]">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
                <div>
                  <p className="text-xs font-normal uppercase tracking-wide text-primary">Workflow</p>
                  <h2 className="text-lg font-normal tracking-normal text-foreground">
                    {confirmDelete ? "Delete workflow" : "Edit workflow"}
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={closeModal}
                  aria-label="Close edit workflow"
                  disabled={saving || deleting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {confirmDelete ? (
                <div className="space-y-4 p-5">
                  <p className="text-sm text-muted-foreground">
                    This permanently deletes the board “{workflow.name}”. Tasks on it are not deleted, but they will no
                    longer belong to this workflow.
                  </p>
                  <label className="grid gap-1.5">
                    <span className="text-sm text-foreground">
                      Type <span className="font-medium text-foreground">{requiredDeletePhrase}</span> to confirm
                    </span>
                    <input
                      className="input"
                      value={deletePhrase}
                      onChange={(event) => setDeletePhrase(event.target.value)}
                      placeholder={requiredDeletePhrase}
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-10 font-normal"
                      disabled={deleting}
                      onClick={() => {
                        setConfirmDelete(false);
                        setDeletePhrase("");
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="destructiveSolid"
                      size="lg"
                      className="h-10 font-normal"
                      disabled={!canConfirmDelete || deleting}
                      onClick={() => void onDelete()}
                    >
                      {deleting ? "Deleting…" : "Delete workflow"}
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-4 p-5">
                  <label className="grid gap-1.5">
                    <span className="text-sm text-foreground">Workflow name</span>
                    <input
                      className="input"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. HEI Website Sprint"
                      required
                      autoFocus
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-sm text-foreground">
                      Description <span className="text-xs text-muted-foreground">optional</span>
                    </span>
                    <textarea
                      className="input"
                      rows={4}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="What work belongs on this board?"
                    />
                  </label>

                  <p className="text-xs text-muted-foreground">
                    Status is calculated from tasks on this board (Not Started → In Progress → Completed).
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="destructiveOutline"
                      size="lg"
                      className="h-10 font-normal"
                      disabled={saving}
                      onClick={() => {
                        setConfirmDelete(true);
                        setDeletePhrase("");
                      }}
                    >
                      Delete workflow
                    </Button>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="lg" className="h-10 font-normal" onClick={closeModal}>
                        Cancel
                      </Button>
                      <Button type="submit" size="lg" className="h-10 font-normal" disabled={saving || !name.trim()}>
                        {saving ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
