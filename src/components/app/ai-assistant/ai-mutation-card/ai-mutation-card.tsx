"use client";

import styles from "./ai-mutation-card.module.css";

import { Check, ExternalLink, GitBranch, ListTodo, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  confirmArgsFromDraft,
  formatConfirmPrompt,
  type AiMutationTool,
  type AiPriority,
  type ChecklistCreateDraft,
  type MutationPreview,
  type MutationResult,
  type NeedsWorkflowResult,
  type TaskCreateDraft,
  type TaskUpdateDraft,
  type WorkflowCreateDraft,
  type WorkflowDeleteDraft,
  type WorkflowListItem,
  type WorkflowOption,
  type WorkflowUpdateDraft,
} from "@/lib/ai/mutation";
import { cn } from "@/lib/utils";

type ToolState = "input-streaming" | "input-available" | "output-available" | "output-error" | string;

type AiMutationCardProps = {
  tool: AiMutationTool;
  state: ToolState;
  output: unknown;
  onConfirm: (promptText: string) => void;
  taskHref?: (taskId: string) => string;
  workflowHref?: (workflowId: string) => string;
  onNavigate?: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function actionLabel(tool: AiMutationTool, action?: string) {
  if (tool === "deleteWorkflow" || action === "delete") return "Hapus workflow";
  if (tool === "updateWorkflow" || (tool === "updateTask" && action === "update")) {
    return tool === "updateTask" ? "Update task" : "Update workflow";
  }
  if (tool === "createChecklist") return "Tambah checklist";
  if (tool === "createWorkflow") return "Buat workflow";
  return "Buat task";
}

export function AiMutationCard({
  tool,
  state,
  output,
  onConfirm,
  taskHref,
  workflowHref,
  onNavigate,
}: AiMutationCardProps) {
  if (state === "input-streaming" || state === "input-available") {
    return <div className={styles.card}><p className={styles.muted}>Menyiapkan ringkasan…</p></div>;
  }
  if (state === "output-error") {
    return <div className={styles.card}><p className={styles.statusError}>Gagal menyiapkan perubahan.</p></div>;
  }
  if (!isRecord(output)) return null;

  if (output.kind === "needsWorkflow") {
    return (
      <NeedsWorkflowCard
        result={output as NeedsWorkflowResult}
        onPick={(workflow) => {
          const title = String(output.title ?? "").trim() || "task baru";
          onConfirm(
            `Pakai workflow ${workflow.name} (${workflow.workflow_id}) untuk membuat task "${title}". Panggil createTask dengan workflowId itu, tanpa confirmed.`,
          );
        }}
      />
    );
  }

  if (output.kind === "result") {
    return (
      <ResultCard
        tool={tool}
        result={output as MutationResult<Record<string, string>>}
        taskHref={taskHref}
        workflowHref={workflowHref}
        onNavigate={onNavigate}
      />
    );
  }

  if (output.kind !== "preview" || !isRecord(output.draft)) return null;

  return (
    <PreviewCard
      tool={tool}
      preview={output as MutationPreview<Record<string, unknown>>}
      onConfirm={onConfirm}
    />
  );
}

function NeedsWorkflowCard({
  result,
  onPick,
}: {
  result: NeedsWorkflowResult;
  onPick: (workflow: WorkflowOption) => void;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <GitBranch className={styles.headerIcon} aria-hidden />
        <p className={styles.eyebrow}>Pilih workflow</p>
      </div>
      <p className={styles.title}>{result.title ? `Board untuk “${result.title}”` : "Board untuk task baru"}</p>
      <p className={styles.muted}>{result.message}</p>
      {result.workflows.length === 0 ? (
        <p className={styles.muted}>Belum ada workflow. Minta AI membuat board baru dulu.</p>
      ) : (
        <ul className={styles.pickList}>
          {result.workflows.map((workflow) => (
            <li key={workflow.workflow_id}>
              <button type="button" className={styles.pickBtn} onClick={() => onPick(workflow)}>
                <span className={styles.pickName}>{workflow.name}</span>
                <span className={styles.pickMeta}>{workflow.project_name || "No project"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultCard({
  tool,
  result,
  taskHref,
  workflowHref,
  onNavigate,
}: {
  tool: AiMutationTool;
  result: MutationResult<Record<string, string>>;
  taskHref?: (taskId: string) => string;
  workflowHref?: (workflowId: string) => string;
  onNavigate?: () => void;
}) {
  if (!result.ok) {
    return (
      <div className={styles.card}>
        <p className={styles.eyebrow}>{actionLabel(tool, result.action)}</p>
        <p className={styles.statusError}>{result.error || "Gagal menyimpan."}</p>
      </div>
    );
  }

  const record = result.record ?? {};
  const taskId = record.task_id;
  const workflowId = record.workflow_id;
  const name = record.title || record.name || "Berhasil";

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Check className={styles.headerIcon} aria-hidden />
        <p className={styles.eyebrow}>Tersimpan</p>
      </div>
      <p className={styles.title}>{name}</p>
      {taskId && taskHref ? (
        <Link href={taskHref(taskId)} className={styles.link} onClick={onNavigate}>
          Buka task <ExternalLink aria-hidden />
        </Link>
      ) : null}
      {workflowId && workflowHref ? (
        <Link href={workflowHref(workflowId)} className={styles.link} onClick={onNavigate}>
          Buka board <ExternalLink aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function PreviewCard({
  tool,
  preview,
  onConfirm,
}: {
  tool: AiMutationTool;
  preview: MutationPreview<Record<string, unknown>>;
  onConfirm: (promptText: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState(preview.draft);

  const confirmText = useMemo(
    () => formatConfirmPrompt(tool, confirmArgsFromDraft(tool, draft)),
    [draft, tool],
  );

  if (cancelled) {
    return (
      <div className={styles.card}>
        <p className={styles.muted}>Dibatalkan. Tidak ada perubahan.</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {tool.includes("Workflow") ? (
          <GitBranch className={styles.headerIcon} aria-hidden />
        ) : (
          <ListTodo className={styles.headerIcon} aria-hidden />
        )}
        <p className={styles.eyebrow}>{actionLabel(tool, preview.action)} · konfirmasi</p>
      </div>

      {editing ? (
        <EditFields tool={tool} draft={draft} onChange={setDraft} />
      ) : (
        <SummaryFields tool={tool} draft={draft} />
      )}

      {preview.warnings?.map((warning) => (
        <p key={warning} className={styles.warn}>
          {warning}
        </p>
      ))}

      <div className={styles.actions}>
        <button
          type="button"
          className={cn(styles.btn, tool === "deleteWorkflow" ? styles.btnDanger : styles.btnPrimary)}
          disabled={submitted}
          onClick={() => {
            setSubmitted(true);
            onConfirm(confirmText);
          }}
        >
          <Check aria-hidden />
          {tool === "deleteWorkflow" ? "Hapus" : "Konfirmasi"}
        </button>
        {tool !== "deleteWorkflow" ? (
          <button type="button" className={styles.btn} disabled={submitted} onClick={() => setEditing((value) => !value)}>
            <Pencil aria-hidden />
            {editing ? "Selesai edit" : "Edit"}
          </button>
        ) : null}
        <button type="button" className={cn(styles.btn, styles.btnGhost)} disabled={submitted} onClick={() => setCancelled(true)}>
          <X aria-hidden />
          Batal
        </button>
      </div>
    </div>
  );
}

function SummaryFields({ tool, draft }: { tool: AiMutationTool; draft: Record<string, unknown> }) {
  if (tool === "createTask") {
    const row = draft as unknown as TaskCreateDraft;
    return (
      <>
        <p className={styles.title}>{row.title}</p>
        <dl className={styles.fields}>
          <Field label="Workflow" value={row.workflowName} />
          <Field label="Project" value={row.projectName} />
          <Field label="Priority" value={row.priority} />
          <Field label="Deadline" value={row.due_date || "—"} />
          {row.description ? <Field label="Deskripsi" value={row.description} /> : null}
        </dl>
      </>
    );
  }

  if (tool === "updateTask") {
    const row = draft as unknown as TaskUpdateDraft;
    return (
      <>
        <p className={styles.title}>{row.title}</p>
        <dl className={styles.fields}>
          {row.changes.length === 0 ? <Field label="Perubahan" value="Tidak ada field yang berubah" /> : null}
          {row.changes.map((change) => (
            <Field key={change.field} label={change.field} value={`${change.from} → ${change.to}`} />
          ))}
        </dl>
      </>
    );
  }

  if (tool === "createChecklist") {
    const row = draft as unknown as ChecklistCreateDraft;
    return (
      <>
        <p className={styles.title}>{row.title}</p>
        <dl className={styles.fields}>
          <Field label="Task" value={`${row.taskId} · ${row.taskTitle}`} />
        </dl>
      </>
    );
  }

  if (tool === "createWorkflow") {
    const row = draft as unknown as WorkflowCreateDraft;
    return (
      <>
        <p className={styles.title}>{row.name}</p>
        <dl className={styles.fields}>
          <Field label="Project" value={row.projectName} />
          <Field label="Format" value={row.presetLabel} />
          <div className={styles.row}>
            <dt className={styles.dt}>Kolom</dt>
            <dd className={styles.dd}>
              <div className={styles.lanes}>
                {row.column_names.map((name) => (
                  <span key={name} className={styles.chip}>
                    {name}
                  </span>
                ))}
              </div>
            </dd>
          </div>
          {row.ticketPrefix ? <Field label="Prefix" value={row.ticketPrefix} /> : null}
          {row.sprintStart || row.sprintEnd ? (
            <Field label="Sprint" value={[row.sprintStart, row.sprintEnd].filter(Boolean).join(" → ")} />
          ) : null}
          {row.backlogTitles.length > 0 ? (
            <Field label="Backlog" value={`${row.backlogTitles.length} tiket`} />
          ) : null}
          {row.description ? <Field label="Deskripsi" value={row.description} /> : null}
        </dl>
      </>
    );
  }

  if (tool === "updateWorkflow") {
    const row = draft as unknown as WorkflowUpdateDraft;
    return (
      <>
        <p className={styles.title}>{row.name}</p>
        <dl className={styles.fields}>
          <Field label="Deskripsi" value={row.description || "—"} />
        </dl>
      </>
    );
  }

  const row = draft as unknown as WorkflowDeleteDraft;
  return (
    <>
      <p className={styles.title}>{row.name}</p>
      <dl className={styles.fields}>
        <Field label="Task terkait" value={String(row.taskCount)} />
      </dl>
    </>
  );
}

function EditFields({
  tool,
  draft,
  onChange,
}: {
  tool: AiMutationTool;
  draft: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  function patch(partial: Record<string, unknown>) {
    onChange({ ...draft, ...partial });
  }

  if (tool === "createTask") {
    const row = draft as unknown as TaskCreateDraft;
    return (
      <div className={styles.edit}>
        <label className={styles.label}>
          Judul
          <input className={styles.input} value={row.title} onChange={(event) => patch({ title: event.target.value })} />
        </label>
        <label className={styles.label}>
          Priority
          <select
            className={styles.select}
            value={row.priority}
            onChange={(event) => patch({ priority: event.target.value as AiPriority })}
          >
            {["Low", "Medium", "High", "Urgent"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Deadline
          <input
            className={styles.input}
            type="date"
            value={row.due_date}
            onChange={(event) => patch({ due_date: event.target.value })}
          />
        </label>
        <label className={styles.label}>
          Deskripsi
          <textarea
            className={styles.textarea}
            value={row.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (tool === "createChecklist") {
    const row = draft as unknown as ChecklistCreateDraft;
    return (
      <label className={styles.label}>
        Judul item
        <input className={styles.input} value={row.title} onChange={(event) => patch({ title: event.target.value })} />
      </label>
    );
  }

  if (tool === "createWorkflow") {
    const row = draft as unknown as WorkflowCreateDraft;
    return (
      <div className={styles.edit}>
        <label className={styles.label}>
          Nama
          <input className={styles.input} value={row.name} onChange={(event) => patch({ name: event.target.value })} />
        </label>
        <label className={styles.label}>
          Preset
          <select
            className={styles.select}
            value={row.preset}
            onChange={(event) => {
              const preset = event.target.value as WorkflowCreateDraft["preset"];
              const labels = { akaal: "Akaal Standard", creative: "Creative Sprint", ops: "Ops Simple" };
              patch({ preset, presetLabel: labels[preset], customColumns: undefined });
            }}
          >
            <option value="akaal">Akaal Standard</option>
            <option value="creative">Creative Sprint</option>
            <option value="ops">Ops Simple</option>
          </select>
        </label>
        <label className={styles.label}>
          Deskripsi
          <textarea
            className={styles.textarea}
            value={row.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (tool === "updateWorkflow") {
    const row = draft as unknown as WorkflowUpdateDraft;
    return (
      <div className={styles.edit}>
        <label className={styles.label}>
          Nama
          <input className={styles.input} value={row.name} onChange={(event) => patch({ name: event.target.value })} />
        </label>
        <label className={styles.label}>
          Deskripsi
          <textarea
            className={styles.textarea}
            value={row.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (tool === "updateTask") {
    const row = draft as unknown as TaskUpdateDraft;
    return (
      <div className={styles.edit}>
        <label className={styles.label}>
          Judul
          <input
            className={styles.input}
            value={row.nextTitle ?? row.title}
            onChange={(event) => patch({ nextTitle: event.target.value })}
          />
        </label>
        {row.due_date !== undefined ? (
          <label className={styles.label}>
            Deadline
            <input
              className={styles.input}
              type="date"
              value={row.due_date}
              onChange={(event) => patch({ due_date: event.target.value })}
            />
          </label>
        ) : null}
      </div>
    );
  }

  return <p className={styles.muted}>Edit lewat chat kalau perlu mengubah detail.</p>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt className={styles.dt}>{label}</dt>
      <dd className={styles.dd}>{value}</dd>
    </div>
  );
}

export function WorkflowListCard({
  state,
  workflows,
  hrefFor,
  onNavigate,
  onPick,
}: {
  state: ToolState;
  workflows: WorkflowListItem[] | WorkflowOption[];
  hrefFor?: (workflowId: string) => string;
  onNavigate?: () => void;
  onPick?: (workflow: WorkflowOption) => void;
}) {
  if (state === "input-streaming" || state === "input-available") {
    return <div className={styles.card}><p className={styles.muted}>Memuat workflow…</p></div>;
  }
  if (state === "output-error") {
    return <div className={styles.card}><p className={styles.statusError}>Gagal memuat workflow.</p></div>;
  }
  if (workflows.length === 0) {
    return <div className={styles.card}><p className={styles.muted}>Belum ada workflow.</p></div>;
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <GitBranch className={styles.headerIcon} aria-hidden />
        <p className={styles.eyebrow}>{workflows.length} workflow</p>
      </div>
      <ul className={styles.pickList}>
        {workflows.map((workflow) => {
          const columns = "column_names" in workflow ? workflow.column_names : [];
          const inner = (
            <>
              <span className={styles.pickName}>{workflow.name}</span>
              <span className={styles.pickMeta}>
                {workflow.project_name || "No project"}
                {columns.length ? ` · ${columns.join(" → ")}` : ""}
              </span>
            </>
          );
          return (
            <li key={workflow.workflow_id}>
              {onPick ? (
                <button type="button" className={styles.pickBtn} onClick={() => onPick(workflow)}>
                  {inner}
                </button>
              ) : hrefFor ? (
                <Link href={hrefFor(workflow.workflow_id)} className={styles.pickBtn} onClick={onNavigate}>
                  {inner}
                </Link>
              ) : (
                <div className={styles.pickBtn}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
