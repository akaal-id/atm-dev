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
import {
  getMockBoardSource,
  isDoneLane,
  mapLaneToTaskStatus,
  mapTaskStatusToLane,
  mockWorkflowTemplates,
  sortedMockColumns,
  type MockWorkflowColumn,
} from "@/lib/data/workflow-templates-mock";
import { updateLocalTaskStatus } from "@/lib/data/workflow-local-store";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";
import type { Task, TaskChecklist, TaskStatus } from "@/lib/types";
import { cn, formatShortDate, groupBy } from "@/lib/utils";

export interface TaskBoardUser {
  user_id: string;
  full_name: string;
}

function finishedSummaryLabel(count: number) {
  return count === 1 ? "1 Task Finished" : `${count} Tasks Finished`;
}

function checklistProgress(items: TaskChecklist[], needsApproval: boolean) {
  const total = items.length;
  if (total === 0) {
    return { total: 0, assigneeDone: 0, leaderDone: 0, needsApproval };
  }
  const assigneeDone = items.filter((item) => item.assignee_completed || item.is_completed).length;
  const leaderDone = items.filter((item) => item.pm_approved).length;
  return { total, assigneeDone, leaderDone, needsApproval };
}

export function TaskBoard({
  tasks,
  users,
  checklists = [],
  canMoveFinished = false,
  workflowTemplateId,
  lockBoardSource = false,
  boardColumns,
}: {
  tasks: Task[];
  users: TaskBoardUser[];
  checklists?: TaskChecklist[];
  canMoveFinished?: boolean;
  /** Mock workflow or template id until API stores board columns. */
  workflowTemplateId?: string | null;
  /** When true, hide the preview-template switcher (workflow detail page). */
  lockBoardSource?: boolean;
  /** Explicit columns for local/custom workflow boards. */
  boardColumns?: MockWorkflowColumn[] | null;
}) {
  const router = useRouter();
  const [demoTemplateId, setDemoTemplateId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [finishedExpanded, setFinishedExpanded] = useState(false);

  const boardSource = useMemo(() => {
    if (boardColumns && boardColumns.length > 0) {
      return {
        id: workflowTemplateId ?? "workflow-board",
        name: "Workflow",
        columns: boardColumns,
      };
    }
    return getMockBoardSource(lockBoardSource ? workflowTemplateId : demoTemplateId ?? workflowTemplateId);
  }, [boardColumns, demoTemplateId, lockBoardSource, workflowTemplateId]);
  const columns: MockWorkflowColumn[] = useMemo(() => sortedMockColumns(boardSource), [boardSource]);
  const laneNames = useMemo(() => columns.map((column) => column.name), [columns]);

  const boardTasks = useMemo(
    () => tasks.map((task) => (statusOverrides[task.task_id] ? { ...task, status: statusOverrides[task.task_id] } : task)),
    [statusOverrides, tasks],
  );
  // Group by template lane (mock mapping from classic task status → column name).
  const grouped = useMemo(
    () => groupBy(boardTasks, (task) => mapTaskStatusToLane(task.status, columns)),
    [boardTasks, columns],
  );

  const userName = (id: string) => users.find((user) => user.user_id === id)?.full_name ?? "Unassigned";

  const checklistsByTask = useMemo(() => {
    const map = new Map<string, TaskChecklist[]>();
    for (const item of checklists) {
      const list = map.get(item.task_id);
      if (list) list.push(item);
      else map.set(item.task_id, [item]);
    }
    return map;
  }, [checklists]);

  const moveTask = async (taskId: string, nextLane: string) => {
    const previousOverrides = statusOverrides;
    const task = boardTasks.find((item) => item.task_id === taskId);
    if (!task) return;

    const nextStatus = mapLaneToTaskStatus(nextLane, columns);
    if (task.status === nextStatus) return;

    setPendingTaskId(taskId);
    setStatusOverrides((current) => ({ ...current, [taskId]: nextStatus }));

    // Local draft backlog tickets live in browser storage until the API exists.
    if (updateLocalTaskStatus(taskId, nextStatus)) {
      setPendingTaskId(null);
      return;
    }

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

  const renderTaskCard = (task: Task) => {
    const currentLane = mapTaskStatusToLane(task.status, columns);
    const needsApproval = taskNeedsLeaderApproval(task);
    const progress = checklistProgress(checklistsByTask.get(task.task_id) ?? [], needsApproval);
    const waitingApproval = task.status === "Waiting Approval";
    const assigneePct = progress.total > 0 ? Math.round((progress.assigneeDone / progress.total) * 100) : 0;
    const leaderPct = progress.total > 0 ? Math.round((progress.leaderDone / progress.total) * 100) : 0;

    return (
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
          "cursor-grab rounded-[2px] border border-border bg-card p-4 transition hover:border-border hover:bg-surface-inset active:cursor-grabbing",
          pendingTaskId === task.task_id && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">#{task.task_id}</code>
            <Link href={`/tasks/${task.task_id}`} className="mt-2 block break-words font-normal text-foreground transition hover:text-primary">
              {task.title}
            </Link>
          </div>
          <TaskStatusPill status={task.status} dueDate={task.due_date} handedOffAt={task.handed_off_at} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={task.priority === "Urgent" ? "red" : task.priority === "High" ? "yellow" : "neutral"}>{task.priority}</Badge>
          <Badge>Due {formatShortDate(task.due_date)}</Badge>
          {needsApproval ? <Badge tone="yellow">2-stage approval</Badge> : null}
          {waitingApproval ? <Badge tone="yellow">Needs leader</Badge> : null}
        </div>
        {progress.total > 0 ? (
          <div className="mt-3 space-y-2 rounded-[2px] border border-border bg-surface-inset px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Checklist</span>
              <span>
                {progress.assigneeDone}/{progress.total} done
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${assigneePct}%` }} />
            </div>
            {needsApproval ? (
              <>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Leader approval</span>
                  <span>
                    {progress.leaderDone}/{progress.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-500 transition-[width]" style={{ width: `${leaderPct}%` }} />
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4">
          <FilterSelect
            label="Move to"
            value={currentLane}
            disabled={pendingTaskId === task.task_id}
            options={laneNames.map((option) => ({
              value: option,
              label: option,
              disabled: isDoneLane(option, columns) && !canMoveFinished,
            }))}
            onValueChange={(value) => void moveTask(task.task_id, value)}
          />
        </div>
        <div className="mt-4 flex -space-x-2">
          {task.assigned_to.map((id) => (
            <Avatar key={id} name={userName(id)} size="sm" />
          ))}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-[2px] border border-border bg-surface-inset px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
            {lockBoardSource ? "Workflow" : "Workflow board"}
          </p>
          <p className="truncate text-sm font-normal text-foreground">
            {boardSource.name}
            <span className="text-muted-foreground"> · {columns.length} columns{lockBoardSource ? "" : " (mock)"}</span>
          </p>
        </div>
        {lockBoardSource ? null : (
          <div className="w-full max-w-xs sm:w-64">
            <FilterSelect
              label="Preview template"
              value={demoTemplateId ?? boardSource.id}
              options={mockWorkflowTemplates.map((item) => ({
                value: item.id,
                label: `${item.name}${item.is_default ? " (default)" : ""}`,
              }))}
              onValueChange={(value) => setDemoTemplateId(value)}
            />
          </div>
        )}
      </div>

      <div className="-mx-1 flex gap-4 overflow-x-auto overscroll-x-contain px-1 pb-1 snap-x snap-mandatory lg:mx-0 lg:px-0 lg:pb-0">
        {laneNames.map((status) => {
          const laneTasks = grouped[status] ?? [];
          const doneLane = isDoneLane(status, columns);
          const canDropIntoLane = !doneLane || canMoveFinished;
          const showCollapsedFinished = doneLane && !finishedExpanded && laneTasks.length > 0;

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
                "w-[min(100%,24rem)] shrink-0 snap-start rounded-[2px] border bg-card transition",
                draggingTaskId ? "border-primary/30" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                <h2 className="min-w-0 truncate text-base font-normal tracking-normal text-foreground">{status}</h2>
                <Badge>
                  <span suppressHydrationWarning>{laneTasks.length}</span>
                </Badge>
              </div>
              <div className="min-h-40 space-y-3 p-4">
                {laneTasks.length === 0 ? (
                  <div className="rounded-[2px] border border-dashed border-border p-5 text-center text-sm font-normal text-muted-foreground">
                    Drop task here
                  </div>
                ) : showCollapsedFinished ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFinishedExpanded(true)}
                    className="h-auto w-full flex-col gap-2 border-dashed border-emerald-200 bg-emerald-50 px-4 py-6 text-center hover:border-emerald-300 hover:bg-emerald-100"
                  >
                    <span className="text-sm font-normal text-emerald-800">{finishedSummaryLabel(laneTasks.length)}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-700">
                      Click to expand
                      <ChevronDown className="size-3.5" />
                    </span>
                  </Button>
                ) : (
                  <>
                    {doneLane ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFinishedExpanded(false)}
                        className="h-auto w-full justify-between border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-normal text-emerald-800 hover:bg-emerald-100"
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
    </div>
  );
}
