"use client";

import Link from "next/link";
import { GitBranch, Plus } from "lucide-react";

import { useTenant } from "@/components/app/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { MockWorkflowTemplate } from "@/lib/data/workflow-templates-mock";
import { cn, formatDate } from "@/lib/utils";
import styles from "./workflow-template-list.module.css";

type WorkflowTemplateListProps = {
  templates: MockWorkflowTemplate[];
};

export function WorkflowTemplateList({ templates }: WorkflowTemplateListProps) {
  const tenant = useTenant();
  const createHref = tenant.href("/admin/workflows/new");

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          Template menentukan kolom status Kanban per proyek. Data di bawah masih tiruan (frontend stub).
        </p>
        <Link href={createHref} className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-10 font-normal")}>
          <Plus className="h-4 w-4" aria-hidden />
          New template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className={styles.empty}>
          <GitBranch className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className={styles.emptyTitle}>Belum ada template workflow</p>
          <p className={styles.emptyText}>Buat template pertama untuk dipakai saat membuat proyek.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {templates.map((template) => {
            const detailHref = tenant.href(`/admin/workflows/${template.id}`);
            return (
              <Link key={template.id} href={detailHref} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.titleBlock}>
                    <h2 className={styles.name}>{template.name}</h2>
                    <p className={styles.description}>{template.description}</p>
                  </div>
                  <div className={styles.badges}>
                    {template.is_default ? <Badge tone="purple">Default</Badge> : null}
                    <Badge tone="blue">{template.columns.length} columns</Badge>
                  </div>
                </div>

                <div className={styles.columns}>
                  {template.columns
                    .slice()
                    .sort((left, right) => left.order_index - right.order_index)
                    .map((column) => (
                      <span
                        key={column.id}
                        className={
                          column.is_2stage_approval_trigger
                            ? `${styles.columnChip} ${styles.columnChipApproval}`
                            : styles.columnChip
                        }
                      >
                        {column.name}
                        {column.is_2stage_approval_trigger ? " · approval" : ""}
                      </span>
                    ))}
                </div>

                <div className={styles.meta}>
                  <span>{template.project_count} projects</span>
                  <span>Updated {formatDate(template.updated_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
