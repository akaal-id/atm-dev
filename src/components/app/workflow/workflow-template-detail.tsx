"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { useTenant } from "@/components/app/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { MockWorkflowColumn, MockWorkflowTemplate } from "@/lib/data/workflow-templates-mock";
import { cn } from "@/lib/utils";
import styles from "./workflow-template-detail.module.css";

type WorkflowTemplateDetailProps = {
  template: MockWorkflowTemplate | null;
};

function nextColumnId() {
  return `wfc_local_${Math.random().toString(36).slice(2, 9)}`;
}

export function WorkflowTemplateDetail({ template }: WorkflowTemplateDetailProps) {
  const tenant = useTenant();
  const { pushToast } = useToast();
  const [columns, setColumns] = useState<MockWorkflowColumn[]>(() =>
    (template?.columns || []).slice().sort((left, right) => left.order_index - right.order_index),
  );
  const [draftName, setDraftName] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const listHref = tenant.href("/admin/workflows");

  const ordered = useMemo(
    () => columns.slice().sort((left, right) => left.order_index - right.order_index),
    [columns],
  );

  function reorderColumns(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setColumns((current) => {
      const sorted = current.slice().sort((left, right) => left.order_index - right.order_index);
      const from = sorted.findIndex((column) => column.id === sourceId);
      const to = sorted.findIndex((column) => column.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = sorted.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((column, index) => ({ ...column, order_index: index }));
    });
  }

  if (!template) {
    return (
      <div className={styles.missing}>
        <p className={styles.empty}>Template tidak ditemukan di data tiruan.</p>
        <Link href={listHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-4 inline-flex h-10")}>
          Back to templates
        </Link>
      </div>
    );
  }

  function renameColumn(columnId: string, name: string) {
    setColumns((current) => current.map((column) => (column.id === columnId ? { ...column, name } : column)));
  }

  function setApprovalTrigger(columnId: string, enabled: boolean) {
    setColumns((current) =>
      current.map((column) => {
        if (column.id === columnId) {
          return { ...column, is_2stage_approval_trigger: enabled };
        }
        // Only one approval-gate column per template (matches 2-stage checklist flow).
        if (enabled && column.is_2stage_approval_trigger) {
          return { ...column, is_2stage_approval_trigger: false };
        }
        return column;
      }),
    );
    pushToast({
      tone: "success",
      title: enabled ? "Approval gate set" : "Approval gate cleared",
      description: enabled
        ? "Checklist 2-tahap akan mendorong task ke kolom ini saat menunggu approval (stub)."
        : "Template ini tidak punya kolom Waiting Approval (stub).",
    });
  }

  function columnRoleLabel(column: MockWorkflowColumn, index: number, total: number) {
    if (column.is_2stage_approval_trigger) return "Approval gate";
    if (index === 0) return "Start";
    if (index === total - 1) return "Done";
    return "In flow";
  }

  function removeColumn(columnId: string) {
    setColumns((current) =>
      current
        .filter((column) => column.id !== columnId)
        .map((column, index) => ({ ...column, order_index: index })),
    );
    pushToast({ tone: "success", title: "Column removed", description: "Urutan lokal diperbarui (stub)." });
  }

  function addColumn() {
    const name = draftName.trim();
    if (!name) return;
    setColumns((current) => [
      ...current,
      {
        id: nextColumnId(),
        name,
        order_index: current.length,
        is_2stage_approval_trigger: false,
      },
    ]);
    setDraftName("");
    pushToast({ tone: "success", title: "Column added", description: `"${name}" ditambahkan ke template (stub).` });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <Link href={listHref} className={styles.back}>
            ← Workflow templates
          </Link>
          <h2 className={styles.name}>{template.name}</h2>
          <p className={styles.description}>{template.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {template.is_default ? <Badge tone="purple">Default</Badge> : null}
          <Badge tone="blue">{ordered.length} columns</Badge>
        </div>
      </div>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Columns & statuses</h3>
        <p className={styles.panelHint}>
          Atur label kolom Kanban dan tandai satu kolom sebagai gerbang approval 2-tahap. Drag handle untuk
          mengubah urutan. Perubahan masih lokal (belum API).
        </p>

        <div className={styles.columnList}>
          {ordered.length === 0 ? (
            <p className={styles.empty}>Belum ada kolom. Tambahkan status pertama di bawah.</p>
          ) : (
            ordered.map((column, index) => {
              const role = columnRoleLabel(column, index, ordered.length);
              return (
              <div
                key={column.id}
                className={cn(
                  styles.columnRow,
                  column.is_2stage_approval_trigger && styles.columnRowApproval,
                  draggingId === column.id && styles.columnRowDragging,
                  dropTargetId === column.id && draggingId !== column.id && styles.columnRowDropTarget,
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggingId && draggingId !== column.id) setDropTargetId(column.id);
                }}
                onDragLeave={() => {
                  if (dropTargetId === column.id) setDropTargetId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData("text/plain") || draggingId;
                  if (sourceId) reorderColumns(sourceId, column.id);
                  setDraggingId(null);
                  setDropTargetId(null);
                }}
              >
                <button
                  type="button"
                  className={styles.dragHandle}
                  draggable
                  aria-label={`Drag to reorder ${column.name}`}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", column.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingId(column.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTargetId(null);
                  }}
                >
                  <GripVertical className="h-4 w-4" aria-hidden />
                </button>
                <span className={styles.index}>{index + 1}</span>
                <div className={styles.columnBody}>
                  <div className={styles.columnLabelRow}>
                    <input
                      className={cn("input", styles.columnName)}
                      value={column.name}
                      onChange={(event) => renameColumn(column.id, event.target.value)}
                      aria-label={`Column ${index + 1} label`}
                      placeholder="Column label"
                    />
                    <Badge tone={column.is_2stage_approval_trigger ? "yellow" : role === "Done" ? "green" : "neutral"}>
                      {role}
                    </Badge>
                  </div>
                  <div className={styles.columnMeta}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={column.is_2stage_approval_trigger}
                      aria-label={`2-stage approval gate for ${column.name || `column ${index + 1}`}`}
                      className={cn(styles.switch, column.is_2stage_approval_trigger && styles.switchOn)}
                      onClick={() => setApprovalTrigger(column.id, !column.is_2stage_approval_trigger)}
                    >
                      <span className={styles.switchThumb} />
                    </button>
                    <div className={styles.switchCopy}>
                      <span className={styles.switchTitle}>2-stage approval</span>
                      <span className={styles.switchHint}>
                        Saat semua item checklist selesai assignee, task masuk kolom ini menunggu approval leader.
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${column.name}`}
                  onClick={() => removeColumn(column.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              );
            })
          )}
        </div>

        <div className={styles.addRow}>
          <input
            className="input"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="New column name"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addColumn();
              }
            }}
          />
          <Button type="button" size="lg" className="h-10 font-normal" onClick={addColumn} disabled={!draftName.trim()}>
            <Plus className="h-4 w-4" aria-hidden />
            Add column
          </Button>
        </div>
      </section>
    </div>
  );
}
