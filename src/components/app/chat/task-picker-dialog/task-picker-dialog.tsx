"use client";

import styles from "./task-picker-dialog.module.css";

import { ListTodo, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ChatTaskCard } from "@/lib/types/chat";

/**
 * Modal that lists tasks from /api/resources/Tasks so the user can attach one
 * to a chat message. Returns the chosen task via onSelect.
 */
export function TaskPickerDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (task: ChatTaskCard) => void;
}) {
  const [tasks, setTasks] = useState<ChatTaskCard[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/resources/Tasks", { headers: { accept: "application/json" } });
        const data = res.ok ? await res.json() : { data: [] };
        if (active) setTasks((data.data ?? []) as ChatTaskCard[]);
      } catch {
        if (active) setTasks([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks.slice(0, 50);
    return tasks.filter((t) => t.title?.toLowerCase().includes(q) || t.task_id?.toLowerCase().includes(q)).slice(0, 50);
  }, [tasks, query]);

  if (!open) return null;

  return (
    <div className={styles.filterBar}>
      <div className={styles.listBody}>
        <div className={styles.filterbarPrimary}>
          <h2 className={styles.heading}>
            <ListTodo className={styles.item} /> Attach a task
          </h2>
          <button type="button" onClick={onClose} className={styles.button} aria-label="Close">
            <X className={styles.close} />
          </button>
        </div>

        <div className={styles.closeAlt}>
          <div className={styles.closeClose}>
            <Search className={styles.closeSearch} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.emptystate}>
          {loading ? (
            <p className={styles.emptyText}>Loading tasks…</p>
          ) : filtered.length === 0 ? (
            <p className={styles.emptyText}>No tasks found.</p>
          ) : (
            filtered.map((task) => (
              <button
                key={task.task_id}
                type="button"
                onClick={() => {
                  onSelect(task);
                  onClose();
                }}
                className={styles.control}
              >
                <span className={styles.taskRow}>
                  <span className={styles.captionSpan}>{task.title || task.task_id}</span>
                  <span className={styles.captionPrimary}>
                    {task.status}
                  </span>
                </span>
                {task.task_id ? <span className={styles.taskId}>{task.task_id}</span> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
