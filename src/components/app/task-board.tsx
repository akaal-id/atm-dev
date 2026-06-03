"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, formatShortDate, groupBy } from "@/lib/utils";
import { workflowBoardStatuses } from "@/lib/workflow";

export interface TaskBoardUser {
  user_id: string;
  full_name: string;
}

export function TaskBoard({ tasks, users, canMoveFinished = false }: { tasks: Task[]; users: TaskBoardUser[]; canMoveFinished?: boolean }) {
  const router = useRouter();
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const boardTasks = useMemo(
    () => tasks.map((task) => (statusOverrides[task.task_id] ? { ...task, status: statusOverrides[task.task_id] } : task)),
    [statusOverrides, tasks],
  );
  const grouped = useMemo(() => groupBy(boardTasks, (task) => task.status), [boardTasks]);

  const userName = (id: string) => users.find((user) => user.user_id === id)?.full_name ?? "Unassigned";

  const moveTask = async (taskId: string, nextStatus: TaskStatus) => {
    const previousOverrides = statusOverrides;
    const task = boardTasks.find((item) => item.task_id === taskId);
    if (!task || task.status === nextStatus) return;

    setPendingTaskId(taskId);
    setStatusOverrides((current) => ({ ...current, [taskId]: nextStatus }));

    const response = await fetch(`/api/resources/Tasks/${taskId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    }).catch(() => null);

    if (!response?.ok) {
      setStatusOverrides(previousOverrides);
    } else {
      window.setTimeout(() => {
        setStatusOverrides((current) => {
          if (current[taskId] !== nextStatus) return current;
          const next = { ...current };
          delete next[taskId];
          return next;
        });
      }, 1200);
    }

    setPendingTaskId(null);
    router.refresh();
  };

  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto overscroll-x-contain px-1 pb-1 snap-x snap-mandatory lg:mx-0 lg:px-0 lg:pb-0">
      {workflowBoardStatuses.map((status) => {
        const laneTasks = grouped[status] ?? [];
        const canDropIntoLane = status !== "Finished" || canMoveFinished;

        return (
          <section
            key={status}
            onDragOver={(event) => {
              if (canDropIntoLane) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!canDropIntoLane) return;
              const taskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
              if (taskId) void moveTask(taskId, status);
              setDraggingTaskId(null);
            }}
            className={cn(
              "w-[min(100%,17.5rem)] shrink-0 snap-start rounded-lg border bg-white shadow-sm transition",
              draggingTaskId ? "border-blue-200" : "border-slate-200",
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
              <h2 className="truncate text-base font-semibold tracking-normal text-slate-950">{status}</h2>
              <Badge>{laneTasks.length}</Badge>
            </div>
            <div className="min-h-40 space-y-3 p-4">
              {laneTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm font-medium text-slate-500">Drop task here</div>
              ) : (
                laneTasks.map((task) => (
                  <article
                    key={task.task_id}
                    draggable
                    onDragStart={(event) => {
                      setDraggingTaskId(task.task_id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", task.task_id);
                    }}
                    onDragEnd={() => setDraggingTaskId(null)}
                    className={cn(
                      "cursor-grab rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50 active:cursor-grabbing",
                      pendingTaskId === task.task_id && "opacity-60",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">#{task.task_id}</code>
                        <Link href={`/tasks/${task.task_id}`} className="mt-2 block break-words font-semibold text-slate-950 transition hover:text-blue-600">
                          {task.title}
                        </Link>
                      </div>
                      <StatusPill status={task.status} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge tone={task.priority === "Urgent" ? "red" : task.priority === "High" ? "yellow" : "neutral"}>{task.priority}</Badge>
                      <Badge>Due {formatShortDate(task.due_date)}</Badge>
                    </div>
                    <label className="mt-4 block text-xs font-semibold text-slate-500">
                      Move to
                      <select
                        value={task.status}
                        disabled={pendingTaskId === task.task_id}
                        onChange={(event) => void moveTask(task.task_id, event.target.value as TaskStatus)}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >
                        {workflowBoardStatuses.map((option) => (
                          <option key={option} disabled={option === "Finished" && !canMoveFinished}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-4 flex -space-x-2">
                      {task.assigned_to.map((id) => (
                        <Avatar key={id} name={userName(id)} size="sm" />
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
