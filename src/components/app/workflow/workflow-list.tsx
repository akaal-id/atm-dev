"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GitBranch, Search } from "lucide-react";

import { useTenant } from "@/components/app/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { FilterSelect } from "@/components/ui/filter-select";
import { StatusPill } from "@/components/ui/status-pill";
import { summarizeWorkflowTasks } from "@/lib/data/workflow-templates-mock";
import { workflowStatuses } from "@/lib/permissions";
import type { Project, Task, Workflow, WorkflowStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import styles from "./workflow-list.module.css";

const ALL = "__all__";
const NO_PROJECT = "__none__";

type WorkflowFilters = {
  query: string;
  projectId: string;
  status: string;
};

type WorkflowListProps = {
  workflows: Workflow[];
  tasks: Task[];
  projects: Project[];
};

export function WorkflowList({ workflows, tasks, projects }: WorkflowListProps) {
  const tenant = useTenant();
  const [filters, setFilters] = useState<WorkflowFilters>({
    query: "",
    projectId: ALL,
    status: ALL,
  });

  const summaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summarizeWorkflowTasks>>();
    for (const workflow of workflows) {
      map.set(workflow.workflow_id, summarizeWorkflowTasks(workflow, tasks));
    }
    return map;
  }, [tasks, workflows]);

  const filteredWorkflows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return workflows.filter((workflow) => {
      const summary = summaries.get(workflow.workflow_id);
      if (!summary) return false;

      if (filters.projectId !== ALL) {
        if (filters.projectId === NO_PROJECT) {
          if (workflow.project_id) return false;
        } else if (workflow.project_id !== filters.projectId) {
          return false;
        }
      }

      if (filters.status !== ALL && summary.status !== filters.status) return false;

      if (query) {
        const projectName = workflow.project_id
          ? projects.find((project) => project.project_id === workflow.project_id)?.project_name ?? ""
          : "";
        const haystack = [workflow.name, workflow.description, projectName, workflow.ticket_id_prefix ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [filters, projects, summaries, workflows]);

  function projectLabel(projectId: string | null | undefined) {
    if (!projectId) return "No project";
    return projects.find((project) => project.project_id === projectId)?.project_name ?? "Unknown project";
  }

  const projectOptions = [
    { value: ALL, label: "All projects" },
    { value: NO_PROJECT, label: "No project" },
    ...projects.map((project) => ({ value: project.project_id, label: project.project_name })),
  ];

  const statusOptions = [
    { value: ALL, label: "All statuses" },
    ...workflowStatuses.map((status: WorkflowStatus) => ({ value: status, label: status })),
  ];

  if (workflows.length === 0) {
    return (
      <div className={styles.empty}>
        <GitBranch className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <p className={styles.emptyTitle}>Belum ada workflow</p>
        <p className={styles.emptyText}>Buat workflow pertama untuk mengelompokkan task di papan Kanban.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <Search className={styles.searchIcon} aria-hidden />
          <input
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            className={styles.searchInput}
            placeholder="Search workflow name, description, or project"
          />
        </label>

        <div className={styles.filterRow}>
          <FilterSelect
            label="Project"
            value={filters.projectId}
            options={projectOptions}
            onValueChange={(projectId) => setFilters((current) => ({ ...current, projectId }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            options={statusOptions}
            onValueChange={(status) => setFilters((current) => ({ ...current, status }))}
          />
        </div>
      </div>

      <div className={styles.resultMeta}>
        <Badge tone="blue">
          <span suppressHydrationWarning>{filteredWorkflows.length}</span> shown
        </Badge>
        <Badge tone="neutral">
          <span suppressHydrationWarning>{workflows.length}</span> total
        </Badge>
      </div>

      {filteredWorkflows.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No workflows match</p>
          <p className={styles.emptyText}>Try another search or clear the filters.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filteredWorkflows.map((workflow) => {
            const summary = summaries.get(workflow.workflow_id)!;
            const detailHref = tenant.href(`/workflows/${workflow.workflow_id}`);
            return (
              <Link key={workflow.workflow_id} href={detailHref} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardHeader}>
                    <div className={styles.titleBlock}>
                      <h2 className={styles.name}>{workflow.name}</h2>
                      <p className={styles.description}>{workflow.description}</p>
                    </div>
                    <div className={styles.badges}>
                      <StatusPill status={summary.status} />
                      <Badge tone={workflow.project_id ? "blue" : "neutral"}>{projectLabel(workflow.project_id)}</Badge>
                      <Badge tone="purple">
                        <span suppressHydrationWarning>{summary.total}</span> tasks
                      </Badge>
                    </div>
                  </div>

                  <div className={styles.columns}>
                    {summary.byColumn.map((column) => (
                      <span
                        key={column.name}
                        className={
                          column.is_2stage_approval_trigger
                            ? `${styles.columnChip} ${styles.columnChipApproval}`
                            : styles.columnChip
                        }
                      >
                        {column.name}
                        <strong className={styles.columnCount}>{column.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.cardBottom}>
                  <div className={styles.progressBlock}>
                    <div className={styles.progressLabel}>
                      <span>Progress</span>
                      <span>
                        {summary.done}/{summary.total} done · {summary.progressPercent}%
                      </span>
                    </div>
                    <div className={styles.progressTrack} aria-hidden>
                      <div className={styles.progressFill} style={{ width: `${summary.progressPercent}%` }} />
                    </div>
                  </div>

                  <div className={styles.meta}>
                    <span>{workflow.columns.length} columns</span>
                    <span>Updated {formatDate(workflow.updated_at)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
