"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TaskStatusPill } from "@/components/ui/status-pill";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, formatShortDate, groupBy } from "@/lib/utils";
import { boardLaneStatuses, workflowBoardStatuses } from "@/lib/workflow";

export interface TaskBoardUser {
  user_id: string;
  full_name: string;
}

function finishedSummaryLabel(count: number) {
  return count === 1 ? "1 Task Finished" : `${count} Tasks Finished`;
}

export function TaskBoard({ tasks, users, canMoveFinished = false }: { tasks: Task[]; users: TaskBoardUser[]; canMoveFinished?: boolean }) {
  const router = useRouter();
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [finishedExpanded, setFinishedExpanded] = useState(false);
  const boardTasks = useMemo(
    () => tasks.map((task) => (statusOverrides[task.task_id] ? { ...task, status: statusOverrides[task.task_id] } : task)),
    [statusOverrides, tasks],
  );
  // Group by the real workflow status — overdue tasks stay in their column and just get a tag.
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

  const renderTaskCard = (task: Task) => (
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
        <TaskStatusPill status={task.status} dueDate={task.due_date} handedOffAt={task.handed_off_at} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={task.priority === "Urgent" ? "red" : task.priority === "High" ? "yellow" : "neutral"}>{task.priority}</Badge>
        <Badge>Due {formatShortDate(task.due_date)}</Badge>
      </div>
      <div className="mt-4">
        <FilterSelect
          label="Move to"
          value={task.status}
          disabled={pendingTaskId === task.task_id}
          options={workflowBoardStatuses.map((option) => ({
            value: option,
            label: option,
            disabled: option === "Finished" && !canMoveFinished,
          }))}
          onValueChange={(value) => void moveTask(task.task_id, value as TaskStatus)}
        />
      </div>
      <div className="mt-4 flex -space-x-2">
        {task.assigned_to.map((id) => (
          <Avatar key={id} name={userName(id)} size="sm" />
        ))}
      </div>
    </article>
  );

  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto overscroll-x-contain px-1 pb-1 snap-x snap-mandatory lg:mx-0 lg:px-0 lg:pb-0">
      {boardLaneStatuses.map((status) => {
        const laneTasks = grouped[status] ?? [];
        const canDropIntoLane = status !== "Finished" || canMoveFinished;
        const isFinishedLane = status === "Finished";
        const showCollapsedFinished = isFinishedLane && !finishedExpanded && laneTasks.length > 0;

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
              "w-[min(100%,24rem)] shrink-0 snap-start rounded-lg border bg-white transition",
              draggingTaskId ? "border-blue-200" : "border-slate-200",
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
              <h2 className="truncate text-base font-semibold tracking-normal text-slate-950">{status}</h2>
              <Badge>{laneTasks.length}</Badge>
            </div>
            <div className="min-h-40 space-y-3 p-4">
              {laneTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm font-medium text-slate-500">
                  Drop task here
                </div>
              ) : showCollapsedFinished ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFinishedExpanded(true)}
                  className="h-auto w-full flex-col gap-2 border-dashed border-emerald-200 bg-emerald-50 px-4 py-6 text-center hover:border-emerald-300 hover:bg-emerald-100"
                >
                  <span className="text-sm font-bold text-emerald-800">{finishedSummaryLabel(laneTasks.length)}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    Click to expand
                    <ChevronDown className="size-3.5" />
                  </span>
                </Button>
              ) : (
                <>
                  {isFinishedLane ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFinishedExpanded(false)}
                      className="h-auto w-full justify-between border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <span>{finishedSummaryLabel(laneTasks.length)}</span>
                      <ChevronUp className="size-4 shrink-0" />
                    </Button>
                  ) : null}
                  {laneTasks.map((task) => renderTaskCard(task))}
                </>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
