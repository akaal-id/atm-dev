"use client";

import styles from "./content-import-modal.module.css";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { requestJson } from "@/lib/request-json";
import type { Task } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

/** Pick existing project tasks to add as content-matrix rows (linked by task #). */
export function ContentImportModal({
  open,
  onClose,
  projectId,
  tasks,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Project tasks that don't have a content row yet. */
  tasks: Task[];
  onImported: (created: number) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => !needle || `${task.task_id} ${task.title}`.toLowerCase().includes(needle));
  }, [tasks, query]);
  const allVisibleSelected = visible.length > 0 && visible.every((task) => selected.has(task.task_id));

  function toggle(taskId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      visible.forEach((task) => (allVisibleSelected ? next.delete(task.task_id) : next.add(task.task_id)));
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{ created: number }>(`/api/projects/${projectId}/content/import`, "POST", { task_ids: [...selected] });
      setSelected(new Set());
      onImported(result.created);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import from tasks" eyebrow="Content matrix">
      <div className={styles.body}>
        <p className={styles.hint}>Each task becomes a content row linked to it — title, publication date, and month come from the task. Its live status shows in the matrix.</p>
        {tasks.length === 0 ? (
          <p className={styles.empty}>Every task in this project already has a content row.</p>
        ) : (
          <>
            <div className={styles.toolbar}>
              <input className="input" placeholder="Search task # or title" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search tasks" />
              <label className={styles.selectAll}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
                Select all ({visible.length})
              </label>
            </div>
            <ul className={styles.list}>
              {visible.map((task) => (
                <li key={task.task_id}>
                  <label className={styles.row}>
                    <input type="checkbox" checked={selected.has(task.task_id)} onChange={() => toggle(task.task_id)} />
                    <span className={styles.id}>{task.task_id}</span>
                    <span className={styles.title}>{task.title}</span>
                    <span className={styles.due}>{task.due_date ? formatShortDate(task.due_date) : "No date"}</span>
                    <StatusPill status={task.status} />
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.footer}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || selected.size === 0}>
            {busy ? <Loader2 className={styles.spin} aria-hidden /> : null}
            Import {selected.size || ""} task{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
