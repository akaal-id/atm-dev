"use client";

import Link from "next/link";

import { useTenant } from "@/components/app/tenant-provider";
import { WorkflowEditModal } from "@/components/app/workflow/workflow-edit-modal";
import type { Project, Workflow } from "@/lib/types";
import styles from "./workflow-board-header.module.css";

export function WorkflowBoardHeader({
  workflow,
  projects,
  canEdit = false,
  actions = null,
}: {
  workflow: Workflow;
  projects: Project[];
  canEdit?: boolean;
  actions?: React.ReactNode;
}) {
  const tenant = useTenant();
  const projectName = workflow.project_id
    ? projects.find((project) => project.project_id === workflow.project_id)?.project_name
    : null;
  const showActions = canEdit || Boolean(actions);

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <Link href={tenant.href("/workflows")} className={styles.back}>
          ← Workflows
        </Link>
        <h1 className={styles.title}>{workflow.name}</h1>
        <p className={styles.meta}>
          {projectName ? <span>{projectName}</span> : <span>No project</span>}
          <span aria-hidden>·</span>
          <span>{workflow.columns.length} columns</span>
          {workflow.description ? (
            <>
              <span aria-hidden>·</span>
              <span className={styles.description}>{workflow.description}</span>
            </>
          ) : null}
        </p>
      </div>

      {showActions ? (
        <div className={styles.actions}>
          {canEdit ? <WorkflowEditModal workflow={workflow} /> : null}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
