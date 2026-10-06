"use client";

import styles from "./project-content-matrix.module.css";

import { Download, ExternalLink, ListPlus, Loader2, MessageSquareText, Pencil, Plus, Search, SquarePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ContentCaptionModal } from "@/components/app/project-dashboard/content-caption-modal";
import { ContentImportModal } from "@/components/app/project-dashboard/content-import-modal";
import { ContentItemModal } from "@/components/app/project-dashboard/content-item-modal";
import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { brandLabel, formatMonth, sortContent } from "@/lib/content-matrix";
import { requestJson } from "@/lib/request-json";
import type { Project, Task } from "@/lib/types";
import type { ContentItem, ProjectHubData } from "@/lib/types/project-hub";
import { formatShortDate } from "@/lib/utils";

const ALL = "__all";

function LinkCell({ href, label }: { href: string; label: string }) {
  if (!href) return <span className={styles.muted}>—</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={styles.linkCell} aria-label={label} title={href}>
      <ExternalLink className={styles.linkIcon} aria-hidden />
      Open
    </a>
  );
}

export function ProjectContentMatrix({
  project,
  hub,
  tasks,
  canContribute,
}: {
  project: Project;
  hub: ProjectHubData;
  /** This project's tasks: their live status shows on linked rows, and unlinked ones can be imported. */
  tasks: Task[];
  canContribute: boolean;
}) {
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();
  const [filters, setFilters] = useState({ month: ALL, brand: ALL, channel: ALL, query: "" });
  const [editing, setEditing] = useState<ContentItem | "new" | null>(null);
  const [captionFor, setCaptionFor] = useState<ContentItem | null>(null);
  const [creatingTask, setCreatingTask] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.task_id, task])), [tasks]);
  const unlinkedTasks = useMemo(() => {
    const linked = new Set(hub.content.map((item) => item.task_id).filter(Boolean));
    return tasks.filter((task) => !linked.has(task.task_id));
  }, [hub.content, tasks]);

  const rows = useMemo(() => sortContent(hub.content), [hub.content]);
  const months = [...new Set(rows.map((row) => row.month).filter(Boolean))].sort();
  const channels = [...new Set(rows.map((row) => row.channel).filter(Boolean))].sort();
  const query = filters.query.trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      (filters.month === ALL || row.month === filters.month) &&
      (filters.brand === ALL || (row.brand_id ?? "") === filters.brand) &&
      (filters.channel === ALL || row.channel === filters.channel) &&
      (!query || row.title.toLowerCase().includes(query) || row.task_id.toLowerCase().includes(query) || row.theme.toLowerCase().includes(query)),
  );
  const brandName = (id: string | null) => brandLabel(id, hub.companyBrands);

  async function createTask(item: ContentItem) {
    if (creatingTask) return;
    setCreatingTask(item.item_id);
    try {
      const description = [
        `Content matrix: ${item.title}`,
        item.brand_id ? `Brand: ${brandName(item.brand_id)}` : "",
        [item.channel, item.funnel, item.pillar].filter(Boolean).join(" · "),
        item.publication_date ? `Publication: ${item.publication_date}` : "",
        item.brief_url ? `Brief: ${item.brief_url}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const task = await requestJson<Task>("/api/resources/Tasks", "POST", {
        title: item.title,
        description,
        project_id: project.project_id,
        due_date: item.publication_date || undefined,
      });
      await requestJson(`/api/projects/${project.project_id}/content/${item.item_id}`, "PATCH", { task_id: task.task_id });
      pushToast({ tone: "success", title: `Task ${task.task_id} created` });
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not create task", description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setCreatingTask(null);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(
        visible.map((row, index) => ({
          "No.": index + 1,
          "Task #": row.task_id,
          Title: row.title,
          Brand: brandName(row.brand_id),
          Month: row.month,
          "Create date": row.create_date,
          "Publication date": row.publication_date,
          Theme: row.theme,
          Funnel: row.funnel,
          Pillar: row.pillar,
          Channel: row.channel,
          "Link brief": row.brief_url,
          "Link drive": row.drive_url,
          "Link publication": row.publication_url,
          Caption: row.caption,
        })),
      );
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Content matrix");
      const safeName = project.project_name.replace(/[^\w\- ]+/g, "").trim() || "project";
      XLSX.writeFile(book, `${safeName} - content matrix.xlsx`);
    } catch (error) {
      pushToast({ tone: "error", title: "Export failed", description: error instanceof Error ? error.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className={styles.root} aria-label="Content matrix">
      <ContentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectId={project.project_id}
        tasks={unlinkedTasks}
        onImported={(created) => {
          setImportOpen(false);
          pushToast({ tone: "success", title: created ? `Imported ${created} task${created === 1 ? "" : "s"} into the matrix` : "Those tasks were already in the matrix" });
          router.refresh();
        }}
      />
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search className={styles.searchIcon} aria-hidden />
          <input
            className="input"
            placeholder="Search title, task #, theme"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
          />
        </label>
        <FormSelect
          name="month"
          fullWidth={false}
          value={filters.month}
          onValueChange={(month) => setFilters({ ...filters, month })}
          options={[{ value: ALL, label: "All months" }, ...months.map((month) => ({ value: month, label: formatMonth(month) }))]}
        />
        <FormSelect
          name="brand"
          fullWidth={false}
          value={filters.brand}
          onValueChange={(brand) => setFilters({ ...filters, brand })}
          options={[{ value: ALL, label: "All brands" }, ...hub.brands.map((brand) => ({ value: brand.brand_id, label: brandName(brand.brand_id) }))]}
        />
        <FormSelect
          name="channel"
          fullWidth={false}
          value={filters.channel}
          onValueChange={(channel) => setFilters({ ...filters, channel })}
          options={[{ value: ALL, label: "All channels" }, ...channels.map((channel) => ({ value: channel, label: channel }))]}
        />
        <div className={styles.toolbarActions}>
          <Button type="button" variant="outline" onClick={() => void exportExcel()} disabled={exporting || visible.length === 0}>
            {exporting ? <Loader2 className={styles.spinner} aria-hidden /> : <Download className={styles.icon} aria-hidden />}
            Export Excel
          </Button>
          {canContribute ? (
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <ListPlus className={styles.icon} aria-hidden />
              Import from tasks
            </Button>
          ) : null}
          {canContribute ? (
            <Button type="button" onClick={() => setEditing("new")}>
              <Plus className={styles.icon} aria-hidden />
              Add content
            </Button>
          ) : null}
        </div>
      </div>

      <p className={styles.summary}>
        {visible.length} of {rows.length} content{rows.length === 1 ? "" : "s"}
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.num}>No.</th>
              <th>Task #</th>
              <th className={styles.titleCol}>Title</th>
              <th>Brand</th>
              <th>Month</th>
              <th>Create date</th>
              <th>Publication date</th>
              <th>Theme</th>
              <th>Funnel</th>
              <th>Pillar</th>
              <th>Channel</th>
              <th>Link brief</th>
              <th>Link drive</th>
              <th>Link publication</th>
              <th className={styles.actionsCol}>
                <span className={styles.srOnly}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={15} className={styles.empty}>
                  {rows.length === 0 ? "No content yet. Add the first row to start the matrix." : "No content matches these filters."}
                </td>
              </tr>
            ) : (
              visible.map((row, index) => (
                <tr key={row.item_id}>
                  <td className={styles.num}>{index + 1}</td>
                  <td>
                    {row.task_id ? (
                      <span className={styles.taskCell}>
                        <Link href={tenant.href(`/tasks/${row.task_id}`)} className={styles.ticket}>
                          {row.task_id}
                        </Link>
                        {taskById.get(row.task_id) ? <StatusPill status={taskById.get(row.task_id)!.status} /> : null}
                      </span>
                    ) : canContribute ? (
                      <button type="button" className={styles.createTask} onClick={() => void createTask(row)} disabled={creatingTask !== null}>
                        {creatingTask === row.item_id ? <Loader2 className={styles.spinnerSm} aria-hidden /> : <SquarePlus className={styles.linkIcon} aria-hidden />}
                        Create task
                      </button>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td className={styles.titleCol}>
                    <button type="button" className={styles.titleButton} onClick={() => setCaptionFor(row)} title="Open caption & links">
                      {row.title}
                    </button>
                  </td>
                  <td>{brandName(row.brand_id) || <span className={styles.muted}>—</span>}</td>
                  <td className={styles.nowrap}>{row.month ? formatMonth(row.month) : "—"}</td>
                  <td className={styles.nowrap}>{row.create_date ? formatShortDate(row.create_date) : "—"}</td>
                  <td className={styles.nowrap}>{row.publication_date ? formatShortDate(row.publication_date) : "—"}</td>
                  <td>{row.theme || <span className={styles.muted}>—</span>}</td>
                  <td>{row.funnel ? <span className={styles.tag}>{row.funnel}</span> : <span className={styles.muted}>—</span>}</td>
                  <td>{row.pillar ? <span className={styles.tag}>{row.pillar}</span> : <span className={styles.muted}>—</span>}</td>
                  <td>{row.channel || <span className={styles.muted}>—</span>}</td>
                  <td><LinkCell href={row.brief_url} label={`Brief for ${row.title}`} /></td>
                  <td><LinkCell href={row.drive_url} label={`Drive for ${row.title}`} /></td>
                  <td><LinkCell href={row.publication_url} label={`Publication for ${row.title}`} /></td>
                  <td className={styles.actionsCol}>
                    <div className={styles.rowActions}>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCaptionFor(row)} aria-label={`Caption for ${row.title}`} title="Caption & links">
                        <MessageSquareText className={styles.icon} />
                      </Button>
                      {canContribute ? (
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(row)} aria-label={`Edit ${row.title}`} title="Edit row">
                          <Pencil className={styles.icon} />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <ContentItemModal
          projectId={project.project_id}
          item={editing === "new" ? null : editing}
          brands={hub.brands}
          allBrands={hub.companyBrands}
          strategy={hub.strategy}
          nextSortOrder={rows.length}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {captionFor ? (
        <ContentCaptionModal projectId={project.project_id} item={captionFor} canEdit={canContribute} onClose={() => setCaptionFor(null)} />
      ) : null}
    </section>
  );
}
