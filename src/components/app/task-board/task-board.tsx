"use client";

import styles from "./task-board.module.css";

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
          styles.panel,
          pendingTaskId === task.task_id && styles.region,
        )}
      >
        <div className={styles.group}>
          <div className={styles.content}>
            <code className={styles.code}>#{task.task_id}</code>
            <Link href={`/tasks/${task.task_id}`} className={styles.link}>
              {task.title}
            </Link>
          </div>
          <TaskStatusPill status={task.status} dueDate={task.due_date} handedOffAt={task.handed_off_at} />
        </div>
        <div className={styles.block}>
          <Badge tone={task.priority === "Urgent" ? "red" : task.priority === "High" ? "yellow" : "neutral"}>{task.priority}</Badge>
          <Badge>Due {formatShortDate(task.due_date)}</Badge>
          {needsApproval ? <Badge tone="yellow">2-stage approval</Badge> : null}
          {waitingApproval ? <Badge tone="yellow">Needs leader</Badge> : null}
        </div>
        {progress.total > 0 ? (
          <div className={styles.surface}>
            <div className={styles.surfaceDiv}>
              <span>Checklist</span>
              <span>
                {progress.assigneeDone}/{progress.total} done
              </span>
            </div>
            <div className={styles.icon}>
              <div className={styles.surfacePrimary} style={{ width: `${assigneePct}%` }} />
            </div>
            {needsApproval ? (
              <>
                <div className={styles.surfaceDiv}>
                  <span>Leader approval</span>
                  <span>
                    {progress.leaderDone}/{progress.total}
                  </span>
                </div>
                <div className={styles.icon}>
                  <div className={styles.fullHeight} style={{ width: `${leaderPct}%` }} />
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <div className={styles.filterBar}>
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
        <div className={styles.surfaceSecondary}>
          {task.assigned_to.map((id) => (
            <Avatar key={id} name={userName(id)} size="sm" />
          ))}
        </div>
      </article>
    );
  };

  return (
    <div className={styles.surfaceTertiary}>
      <div className={styles.surfaceAlt}>
        <div className={styles.content}>
          <p className={styles.itemMeta}>
            {lockBoardSource ? "Workflow" : "Workflow board"}
          </p>
          <p className={styles.text}>
            {boardSource.name}
            <span className={styles.meta}> · {columns.length} columns{lockBoardSource ? "" : " (mock)"}</span>
          </p>
        </div>
        {lockBoardSource ? null : (
          <div className={styles.listBody}>
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

      <div className={styles.surfaceAside}>
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
                styles.wmin10024rem,
                draggingTaskId ? styles.surfaceInner : styles.surfaceOuter,
              )}
            >
              <div className={styles.surfaceLead}>
                <h2 className={styles.heading}>{status}</h2>
                <Badge>
                  <span suppressHydrationWarning>{laneTasks.length}</span>
                </Badge>
              </div>
              <div className={styles.surfaceTrail}>
                {laneTasks.length === 0 ? (
                  <div className={styles.surfaceMain}>
                    Drop task here
                  </div>
                ) : showCollapsedFinished ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFinishedExpanded(true)}
                    className={styles.hauto}
                  >
                    <span className={styles.caption}>{finishedSummaryLabel(laneTasks.length)}</span>
                    <span className={styles.captionSpan}>
                      Click to expand
                      <ChevronDown className={styles.iconChevrondown} />
                    </span>
                  </Button>
                ) : (
                  <>
                    {doneLane ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFinishedExpanded(false)}
                        className={styles.button}
                      >
                        <span>{finishedSummaryLabel(laneTasks.length)}</span>
                        <ChevronUp className={styles.iconChevronup} />
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
