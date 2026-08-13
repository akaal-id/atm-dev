"use client";

import styles from "./ai-context-panel.module.css";

import {
  AlarmClockOff,
  ArrowRight,
  BadgeCheck,
  Ban,
  Bot,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  FilePenLine,
  Hourglass,
  Info,
  ListTodo,
  PlayCircle,
  Sparkles,
  TimerOff,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { WorkflowListCard } from "@/components/app/ai-assistant/ai-mutation-card";
import { AiTaskDetailCard } from "@/components/app/ai-assistant/ai-task-detail-card";
import { Button } from "@/components/ui/button";
import { statusTone } from "@/components/ui/status-pill";
import type { WorkflowListItem } from "@/lib/ai/mutation";
import type { AiTaskDetail, AiTaskPickItem } from "@/lib/ai/task-detail";
import type { Priority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TaskListItem = {
  task_id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string;
  is_due_today: boolean;
  is_overdue: boolean;
};

/** Left panel content — always just the single most recently called view/detail tool. */
export type ActiveContext =
  | { kind: "tasks"; key: string; tasks: TaskListItem[] }
  | {
      kind: "taskDetail";
      key: string;
      output:
        | { ok: true; task: AiTaskDetail }
        | { ok: false; error: string }
        | { ok: false; pick: true; tasks: AiTaskPickItem[] };
    }
  | { kind: "workflows"; key: string; workflows: WorkflowListItem[] };

/** One distinct icon per workflow status. Overdue is a separate badge icon, not a replacement. */
function statusIcon(status: TaskStatus): LucideIcon {
  switch (status) {
    case "To Do":
      return ListTodo;
    case "In Progress":
      return PlayCircle;
    case "Waiting Approval":
      return Hourglass;
    case "Ready":
      return CircleCheck;
    case "Finished":
      return CheckCircle2;
    case "Need Revision":
      return FilePenLine;
    case "Approved":
      return BadgeCheck;
    case "Done":
      return CheckCheck;
    case "Late":
      return TimerOff;
    case "Cancelled":
      return Ban;
    case "Overdue":
      return AlarmClockOff;
    default:
      return ListTodo;
  }
}

function formatDueDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function toneClass(tone: ReturnType<typeof statusTone>) {
  switch (tone) {
    case "blue":
      return styles.toneBlue;
    case "green":
      return styles.toneGreen;
    case "yellow":
      return styles.toneYellow;
    case "red":
      return styles.toneRed;
    default:
      return styles.toneNeutral;
  }
}

function TaskListPanel({
  tasks,
  hrefFor,
  onNavigate,
  onSendPrompt,
}: {
  tasks: TaskListItem[];
  hrefFor: (taskId: string) => string;
  onNavigate: () => void;
  onSendPrompt: (promptText: string) => void;
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return <div className={styles.taskEmpty}>Tidak ada task aktif.</div>;
  }

  return (
    <div className={styles.taskPanel}>
      <div className={styles.taskPanelHeader}>
        <ListTodo className={styles.taskPanelHeaderIcon} aria-hidden />
        <span className={styles.taskPanelHeaderLabel}>{tasks.length} task aktif</span>
      </div>

      <ul className={styles.taskList}>
        {tasks.map((task) => {
          const Icon = statusIcon(task.status);
          const tone = statusTone(task.status);
          const statusLabel = task.is_overdue ? `${task.status} · Overdue` : task.status;
          const isExpanded = expandedTaskId === task.task_id;
          const dueLabel = task.is_overdue
            ? "Overdue"
            : task.is_due_today
              ? "Due hari ini"
              : formatDueDate(task.due_date);

          return (
            <li key={task.task_id} className={cn(styles.taskItem, isExpanded && styles.taskItemExpanded)}>
              <div className={styles.taskCardHeader}>
                <button
                  type="button"
                  className={styles.taskCard}
                  onClick={() => setExpandedTaskId((prev) => (prev === task.task_id ? null : task.task_id))}
                  title={statusLabel}
                  aria-expanded={isExpanded}
                  aria-label={`${task.title}, status ${statusLabel}`}
                >
                  <span className={cn(styles.taskIcon, toneClass(tone))} aria-hidden>
                    <Icon className={styles.taskIconSvg} />
                  </span>

                  <span className={styles.taskBody}>
                    <span className={styles.taskTitle}>{task.title}</span>
                    <span className={styles.taskMeta}>
                      <span className={cn(styles.taskStatus, toneClass(tone))}>{task.status}</span>
                      {dueLabel ? (
                        <span
                          className={cn(
                            styles.taskDue,
                            task.is_overdue && styles.taskDueOverdue,
                            task.is_due_today && !task.is_overdue && styles.taskDueToday,
                          )}
                        >
                          {dueLabel}
                        </span>
                      ) : null}
                      {task.priority ? <span className={styles.taskPriority}>{task.priority}</span> : null}
                    </span>
                  </span>

                  <span className={styles.expandIcon} aria-hidden>
                    {isExpanded ? (
                      <ChevronDown className={styles.taskChevron} />
                    ) : (
                      <ChevronRight className={styles.taskChevron} />
                    )}
                  </span>
                </button>

                <Link
                  href={hrefFor(task.task_id)}
                  className={styles.taskLinkBtn}
                  onClick={onNavigate}
                  title="Buka detail halaman task"
                  aria-label={`Buka detail ${task.title}`}
                >
                  <ExternalLink className={styles.taskLinkIcon} aria-hidden />
                </Link>
              </div>

              {isExpanded ? (
                <div className={styles.taskActions}>
                  <p className={styles.taskActionsLabel}>Aksi cepat</p>
                  <div className={styles.actionGrid}>
                    <button
                      type="button"
                      className={cn(styles.actionBtn, styles.actionBtnPrimary)}
                      onClick={() =>
                        onSendPrompt(
                          `Tampilkan detail lengkap task #${task.task_id} "${task.title}". Panggil getTask dengan taskId itu.`,
                        )
                      }
                    >
                      <Info className={styles.actionBtnIcon} />
                      <span>Detail</span>
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() =>
                        onSendPrompt(
                          `Saya ingin meng-update status atau progres untuk task #${task.task_id}: "${task.title}". Tolong tanyakan detail perubahan yang perlu di-update.`,
                        )
                      }
                    >
                      <Bot className={styles.actionBtnIcon} />
                      <span>Update</span>
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() =>
                        onSendPrompt(
                          `Saya ingin mengedit detail (judul, deskripsi, priority, atau deadline) untuk task #${task.task_id}: "${task.title}". Tolong tanyakan bagian mana yang ingin diubah.`,
                        )
                      }
                    >
                      <Sparkles className={styles.actionBtnIcon} />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() =>
                        onSendPrompt(
                          `Tolong bantu buatkan breakdown sub-task / checklist baru untuk task #${task.task_id}: "${task.title}".`,
                        )
                      }
                    >
                      <CheckSquare className={styles.actionBtnIcon} />
                      <span>Sub-task</span>
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() =>
                        onSendPrompt(
                          `Bantu saya meninjau task #${task.task_id} "${task.title}". Apa rekomendasi atau langkah selanjutnya untuk task ini?`,
                        )
                      }
                    >
                      <ArrowRight className={styles.actionBtnIcon} />
                      <span>Rekomendasi</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Left-side panel — pushes chat layout (not an overlay) so it never covers the
 * centered thread. Content always reflects whichever getMyTasks / getTask /
 * listWorkflows / getWorkflow call was made most recently; the caller derives
 * `context` from the message list and just tells us open/closed.
 */
export function AiContextPanel({
  open,
  context,
  onClose,
  taskHref,
  workflowHref,
  onNavigate,
  onSendPrompt,
}: {
  open: boolean;
  context: ActiveContext | null;
  onClose: () => void;
  taskHref: (taskId: string) => string;
  workflowHref: (workflowId: string) => string;
  onNavigate: () => void;
  onSendPrompt: (promptText: string) => void;
}) {
  const isOpen = open && Boolean(context);
  const title =
    context?.kind === "tasks" ? "Daftar Task" : context?.kind === "taskDetail" ? "Detail Task" : "Workflow";

  return (
    <aside className={cn(styles.panel, isOpen && styles.panelOpen)} aria-hidden={!isOpen}>
      <div className={styles.panelInner}>
        <div className={styles.panelHeader}>
          <p className={styles.panelTitle}>{title}</p>
          <Button type="button" variant="ghost" size="icon" aria-label="Tutup panel" onClick={onClose}>
            <X className={styles.closeIcon} aria-hidden />
          </Button>
        </div>
        <div className={styles.panelBody}>
          {context?.kind === "tasks" ? (
            <TaskListPanel
              tasks={context.tasks}
              hrefFor={taskHref}
              onNavigate={onNavigate}
              onSendPrompt={onSendPrompt}
            />
          ) : context?.kind === "taskDetail" ? (
            <AiTaskDetailCard
              state="output-available"
              output={context.output}
              hrefFor={taskHref}
              onNavigate={onNavigate}
              onSendPrompt={onSendPrompt}
            />
          ) : context?.kind === "workflows" ? (
            <WorkflowListCard state="output-available" workflows={context.workflows} hrefFor={workflowHref} onNavigate={onNavigate} />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
