"use client";

import styles from "./ai-task-detail-card.module.css";

import { CalendarDays, Check, ChevronDown, ExternalLink, Folder, GitBranch, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/toast";
import type { AiPriority } from "@/lib/ai/mutation";
import type { AiTaskChecklistItem, AiTaskDetail, AiTaskPickItem } from "@/lib/ai/task-detail";
import type { TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { progressForWorkflowStatus, workflowBoardStatuses } from "@/lib/workflow";

type ToolState = "input-streaming" | "input-available" | "output-available" | "output-error" | string;

type GetTaskOutput =
  | { ok: true; task: AiTaskDetail }
  | { ok: false; error: string }
  | { ok: false; pick: true; tasks: AiTaskPickItem[] };

type AiTaskDetailCardProps = {
  state: ToolState;
  output: GetTaskOutput | undefined;
  hrefFor: (taskId: string) => string;
  onNavigate: () => void;
  onSendPrompt: (promptText: string) => void;
};

const PRIORITIES: AiPriority[] = ["Low", "Medium", "High", "Urgent"];

function statusChip(status: string) {
  if (status === "Finished" || status === "Done" || status === "Approved" || status === "Ready") return styles.chipGreen;
  if (status === "In Progress" || status === "Waiting Approval") return styles.chipBlue;
  if (status === "Need Revision" || status === "Late") return styles.chipYellow;
  if (status === "Cancelled" || status === "Overdue") return styles.chipRed;
  return styles.chipSlate;
}

function priorityChip(priority: string) {
  if (priority === "Urgent") return styles.chipRed;
  if (priority === "High") return styles.chipYellow;
  if (priority === "Medium") return styles.chipViolet;
  return styles.chipSlate;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? parts[0]?.[1] ?? ""}`;
  return letters.toUpperCase() || "?";
}

function formatWhen(value: string) {
  if (!value) return "Belum ada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function dateInputValue(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

async function patchJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as { data?: Record<string, unknown>; error?: string } | null;
  if (!response.ok) throw new Error(json?.error || "Gagal menyimpan");
  return json?.data;
}

export function AiTaskDetailCard({ state, output, hrefFor, onNavigate, onSendPrompt }: AiTaskDetailCardProps) {
  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Memuat detail task…</p>
      </div>
    );
  }

  if (state === "output-error" || !output) {
    return (
      <div className={styles.card}>
        <p className={styles.error}>Gagal memuat detail task.</p>
      </div>
    );
  }

  if (!output.ok && "pick" in output && output.pick) {
    return (
      <div className={styles.card}>
        <p className={styles.kicker}>Beberapa task cocok</p>
        <p className={styles.title}>Pilih task</p>
        <ul className={styles.pickList}>
          {output.tasks.map((task) => (
            <li key={task.task_id}>
              <button
                type="button"
                className={styles.pickBtn}
                onClick={() =>
                  onSendPrompt(`Tampilkan detail task #${task.task_id} "${task.title}". Panggil getTask dengan taskId itu.`)
                }
              >
                <span className={styles.pickName}>{task.title}</span>
                <span className={styles.pickMeta}>
                  {task.task_id} · {task.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!output.ok) {
    return (
      <div className={styles.card}>
        <p className={styles.error}>{output.error}</p>
      </div>
    );
  }

  return <InteractiveTaskCard task={output.task} hrefFor={hrefFor} onNavigate={onNavigate} />;
}

function InteractiveTaskCard({
  task: initial,
  hrefFor,
  onNavigate,
}: {
  task: AiTaskDetail;
  hrefFor: (taskId: string) => string;
  onNavigate: () => void;
}) {
  const { pushToast } = useToast();
  const [task, setTask] = useState(initial);
  const [savedTitle, setSavedTitle] = useState(initial.title);
  const [saving, setSaving] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(Boolean(initial.report));
  const [reportDraft, setReportDraft] = useState(initial.report);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    setTask(initial);
    setSavedTitle(initial.title);
    setReportDraft(initial.report);
    setReportOpen(Boolean(initial.report));
  }, [initial]);

  const doneCount = task.checklist.filter((item) => item.is_completed).length;
  const progress = useMemo(() => {
    if (task.checklist.length > 0) return Math.round((doneCount / task.checklist.length) * 100);
    return Math.max(0, Math.min(100, Math.round(task.progress)));
  }, [doneCount, task.checklist.length, task.progress]);

  const boardStatus = workflowBoardStatuses.includes(task.status as (typeof workflowBoardStatuses)[number])
    ? task.status
    : "To Do";

  async function saveTask(patch: Record<string, unknown>, key: string) {
    setSaving(key);
    try {
      const data = await patchJson(`/api/resources/Tasks/${task.task_id}`, patch);
      setTask((current) => {
        const next = { ...current };
        if (typeof patch.status === "string") {
          next.status = patch.status as TaskStatus;
          next.progress = typeof data?.progress === "number" ? data.progress : progressForWorkflowStatus(next.status);
        }
        if (typeof patch.priority === "string") next.priority = patch.priority as AiPriority;
        if (typeof patch.due_date === "string") {
          next.due_date = patch.due_date;
          const today = new Date().toISOString().slice(0, 10);
          next.is_due_today = patch.due_date === today;
          next.is_overdue = Boolean(patch.due_date) && patch.due_date < today && next.status !== "Finished";
        }
        if (typeof patch.report === "string") next.report = patch.report;
        if (typeof patch.title === "string" && patch.title.trim()) next.title = patch.title.trim();
        return next;
      });
      if (typeof patch.title === "string" && patch.title.trim()) setSavedTitle(patch.title.trim());
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Tidak tersimpan",
        description: error instanceof Error ? error.message : "Gagal update task.",
      });
    } finally {
      setSaving(null);
    }
  }

  async function toggleChecklist(item: AiTaskChecklistItem) {
    setSaving(`check-${item.checklist_id}`);
    const nextDone = !item.is_completed;
    setTask((current) => ({
      ...current,
      checklist: current.checklist.map((row) =>
        row.checklist_id === item.checklist_id ? { ...row, is_completed: nextDone } : row,
      ),
    }));
    try {
      await patchJson(`/api/resources/Task_Checklists/${item.checklist_id}`, { assignee_completed: nextDone });
    } catch (error) {
      setTask((current) => ({
        ...current,
        checklist: current.checklist.map((row) =>
          row.checklist_id === item.checklist_id ? { ...row, is_completed: item.is_completed } : row,
        ),
      }));
      pushToast({
        tone: "error",
        title: "Checklist gagal diubah",
        description: error instanceof Error ? error.message : "Coba lagi.",
      });
    } finally {
      setSaving(null);
    }
  }

  async function addChecklist(event: React.FormEvent) {
    event.preventDefault();
    const title = newItem.trim();
    if (!title || saving) return;
    setSaving("add-check");
    try {
      const response = await fetch("/api/resources/Task_Checklists", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ task_id: task.task_id, title }),
      });
      const json = (await response.json().catch(() => null)) as
        | { data?: { checklist_id?: string; title?: string }; error?: string }
        | null;
      if (!response.ok) throw new Error(json?.error || "Gagal menambah checklist");
      const created = json?.data;
      setNewItem("");
      setTask((current) => ({
        ...current,
        checklist: [
          ...current.checklist,
          {
            checklist_id: String(created?.checklist_id ?? `tmp_${Date.now()}`),
            title: String(created?.title ?? title),
            is_completed: false,
          },
        ],
      }));
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Gagal menambah item",
        description: error instanceof Error ? error.message : "Coba lagi.",
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <article className={cn(styles.card, task.is_overdue && styles.cardOverdue)}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.topRow}>
            <span className={styles.idChip}>{task.task_id}</span>
            {task.is_overdue ? <span className={cn(styles.chip, styles.chipRed)}>Overdue</span> : null}
            {task.is_due_today && !task.is_overdue ? (
              <span className={cn(styles.chip, styles.chipYellow)}>Hari ini</span>
            ) : null}
          </div>
          <input
            className={styles.titleInput}
            value={task.title}
            disabled={saving === "title"}
            aria-label="Judul task"
            onChange={(event) => setTask((current) => ({ ...current, title: event.target.value }))}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (!next) {
                setTask((current) => ({ ...current, title: savedTitle }));
                return;
              }
              if (next !== savedTitle) void saveTask({ title: next }, "title");
            }}
          />
        </div>
        <Link
          href={hrefFor(task.task_id)}
          className={styles.link}
          onClick={onNavigate}
          title="Buka halaman task"
          aria-label={`Buka halaman ${task.title}`}
        >
          <ExternalLink className={styles.linkIcon} aria-hidden />
        </Link>
      </header>

      {task.description ? <p className={styles.description}>{task.description}</p> : null}

      <div className={styles.pills}>
        <label className={cn(styles.chip, styles.chipSelect, statusChip(boardStatus))}>
          <span>{boardStatus}</span>
          <ChevronDown className={styles.chipCaret} aria-hidden />
          <select
            className={styles.chipNative}
            value={boardStatus}
            disabled={Boolean(saving)}
            aria-label="Status"
            onChange={(event) => void saveTask({ status: event.target.value }, "status")}
          >
            {workflowBoardStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className={cn(styles.chip, styles.chipSelect, priorityChip(task.priority))}>
          <span>{task.priority}</span>
          <ChevronDown className={styles.chipCaret} aria-hidden />
          <select
            className={styles.chipNative}
            value={task.priority}
            disabled={Boolean(saving)}
            aria-label="Priority"
            onChange={(event) => void saveTask({ priority: event.target.value }, "priority")}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.progressBlock}>
        <div className={styles.progressMeta}>
          <span>Progress</span>
          <span className={styles.progressValue}>
            {task.checklist.length > 0 ? `${doneCount}/${task.checklist.length}` : null}
            <strong>{progress}%</strong>
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${Math.max(progress, progress === 0 ? 0 : 2)}%` }} />
        </div>
      </div>

      <div className={styles.metaGrid}>
        <label className={cn(styles.metaTile, task.is_overdue && styles.metaTileAlert)}>
          <CalendarDays className={styles.metaIcon} aria-hidden />
          <span>
            <span className={styles.metaLabel}>Deadline</span>
            <span className={styles.metaValue}>{formatWhen(task.due_date)}</span>
          </span>
          <input
            className={styles.dueNative}
            type="date"
            value={dateInputValue(task.due_date)}
            disabled={Boolean(saving)}
            onChange={(event) => void saveTask({ due_date: event.target.value }, "due_date")}
          />
        </label>
        <div className={styles.metaTile}>
          <Folder className={styles.metaIcon} aria-hidden />
          <span>
            <span className={styles.metaLabel}>Project</span>
            <span className={styles.metaValue}>{task.project_name}</span>
          </span>
        </div>
        {task.workflow_name ? (
          <div className={styles.metaTile}>
            <GitBranch className={styles.metaIcon} aria-hidden />
            <span>
              <span className={styles.metaLabel}>Workflow</span>
              <span className={styles.metaValue}>{task.workflow_name}</span>
            </span>
          </div>
        ) : null}
        <div className={styles.metaTile}>
          <span className={styles.avatarStack} aria-hidden>
            {task.assignees.slice(0, 3).map((name) => (
              <span key={name} className={styles.avatar} title={name}>
                {initials(name)}
              </span>
            ))}
          </span>
          <span>
            <span className={styles.metaLabel}>Assignee</span>
            <span className={styles.metaValue}>
              {task.assignees.length ? task.assignees.join(", ") : "Belum di-assign"}
            </span>
          </span>
        </div>
      </div>

      {task.labels.length > 0 ? (
        <div className={styles.labelRow}>
          {task.labels.map((label) => (
            <span key={label} className={styles.labelChip}>
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <p className={styles.panelTitle}>Checklist</p>
          {task.checklist.length > 0 ? (
            <span className={styles.panelCount}>
              {doneCount}/{task.checklist.length}
            </span>
          ) : null}
        </div>
        {task.checklist.length > 0 ? (
          <ul className={styles.checklist}>
            {task.checklist.map((item) => (
              <li key={item.checklist_id}>
                <button
                  type="button"
                  className={cn(styles.checkBtn, item.is_completed && styles.checkItemDone)}
                  disabled={saving === `check-${item.checklist_id}`}
                  onClick={() => void toggleChecklist(item)}
                >
                  <span className={cn(styles.checkBox, item.is_completed && styles.checkBoxOn)} aria-hidden>
                    {item.is_completed ? <Check className={styles.checkIcon} /> : null}
                  </span>
                  <span>{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Belum ada sub-task.</p>
        )}
        <form className={styles.addRow} onSubmit={(event) => void addChecklist(event)}>
          <input
            className={styles.addInput}
            value={newItem}
            placeholder="Tambah sub-task"
            disabled={saving === "add-check"}
            onChange={(event) => setNewItem(event.target.value)}
          />
          <button type="submit" className={styles.addBtn} disabled={!newItem.trim() || saving === "add-check"} aria-label="Tambah checklist">
            <Plus aria-hidden />
          </button>
        </form>
      </section>

      <section className={styles.panel}>
        <button type="button" className={styles.panelHeadBtn} onClick={() => setReportOpen((open) => !open)}>
          <span className={styles.panelTitle}>Report</span>
          <ChevronDown className={cn(styles.chipCaret, reportOpen && styles.caretOpen)} aria-hidden />
        </button>
        {reportOpen ? (
          <div className={styles.reportBody}>
            <textarea
              className={styles.reportField}
              value={reportDraft}
              placeholder="Catatan penyelesaian…"
              disabled={saving === "report"}
              onChange={(event) => setReportDraft(event.target.value)}
            />
            <button
              type="button"
              className={styles.saveBtn}
              disabled={saving === "report" || reportDraft === task.report}
              onClick={() => void saveTask({ report: reportDraft }, "report")}
            >
              Simpan report
            </button>
          </div>
        ) : null}
      </section>

      {task.comments.length > 0 ? (
        <section className={styles.panel}>
          <p className={styles.panelTitle}>Komentar</p>
          {task.comments.map((comment) => (
            <div key={comment.comment_id} className={styles.comment}>
              <span className={styles.avatar}>{initials(comment.author)}</span>
              <div>
                <span className={styles.commentMeta}>
                  {comment.author} · {formatWhen(comment.created_at)}
                </span>
                <p className={styles.commentBody}>{comment.comment}</p>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </article>
  );
}
