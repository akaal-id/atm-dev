"use client";

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
    <div className="fixed inset-0 z-50 grid place-items-end bg-neutral-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
      <div className="flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-[2px] bg-card shadow-2xl sm:max-w-lg sm:rounded-[2px]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-normal text-foreground">
            <ListTodo className="h-4 w-4 text-primary" /> Attach a task
          </h2>
          <button type="button" onClick={onClose} className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2 rounded-[2px] border border-border px-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className="h-9 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Loading tasks…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No tasks found.</p>
          ) : (
            filtered.map((task) => (
              <button
                key={task.task_id}
                type="button"
                onClick={() => {
                  onSelect(task);
                  onClose();
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-[2px] px-3 py-2 text-left transition hover:bg-surface-inset"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="line-clamp-1 text-sm font-normal text-foreground">{task.title || task.task_id}</span>
                  <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                    {task.status}
                  </span>
                </span>
                {task.task_id ? <span className="text-[11px] text-muted-foreground">{task.task_id}</span> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
