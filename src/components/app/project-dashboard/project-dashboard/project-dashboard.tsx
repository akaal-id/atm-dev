"use client";

import styles from "./project-dashboard.module.css";

import { ArrowLeft, FolderOpen, LayoutDashboard, Megaphone, Pencil, Table2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ProjectContentMatrix } from "@/components/app/project-dashboard/project-content-matrix";
import { ProjectFilesPanel } from "@/components/app/project-dashboard/project-files-panel";
import { ProjectOverview } from "@/components/app/project-dashboard/project-overview";
import { ProjectSettingsModal } from "@/components/app/project-dashboard/project-settings-modal";
import { ProjectSocialDashboard } from "@/components/app/project-dashboard/project-social-dashboard";
import { useTenant } from "@/components/app/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import type { Project, ProjectFile, Task } from "@/lib/types";
import type { OfficeFileSummary } from "@/lib/types/office";
import type { ProjectHubData, ProjectUserSummary } from "@/lib/types/project-hub";

export type ProjectDashboardProps = {
  project: Project;
  canEdit: boolean;
  /** Editors and project members can edit the content matrix. */
  canContribute: boolean;
  /** Tab to open first (from `?tab=`). */
  initialTab?: string;
  users: ProjectUserSummary[];
  tasks: Task[];
  files: ProjectFile[];
  hub: ProjectHubData;
  /** True when hub tables could not be read (e.g. not in Supabase mode). */
  hubUnavailable: boolean;
  /** Office sheets/docs filed under this project. */
  officeFiles: OfficeFileSummary[];
};

const baseTabs = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard aria-hidden /> },
  { id: "social", label: "Social Media", icon: <Megaphone aria-hidden /> },
  { id: "content", label: "Content Matrix", icon: <Table2 aria-hidden /> },
  { id: "files", label: "Files & SOP", icon: <FolderOpen aria-hidden /> },
];

export function ProjectDashboard(props: ProjectDashboardProps) {
  const { project, canEdit, hub, hubUnavailable } = props;
  const tenant = useTenant();
  const isSocialProject = project.project_type === "social_media";
  const tabs = baseTabs.filter((item) => {
    if (item.id === "social") return isSocialProject && !hubUnavailable;
    if (item.id === "content") return !hubUnavailable;
    return true;
  });
  const [tab, setTabState] = useState(() => (tabs.some((item) => item.id === props.initialTab) ? props.initialTab! : "overview"));

  // Mirror the tab in the URL so it survives refresh and can be shared.
  function setTab(next: string) {
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href={tenant.href("/projects")} className={styles.back}>
          <ArrowLeft className={styles.icon} aria-hidden />
          Projects
        </Link>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <p className={styles.ticket}>{project.ticket_id_prefix || project.project_id}</p>
            <h1 className={styles.title}>{project.project_name}</h1>
            <div className={styles.meta}>
              <StatusPill status={project.status} />
              <Badge tone={isSocialProject ? "purple" : "neutral"}>{isSocialProject ? "Social media" : "General"}</Badge>
              {hub.brands.map((brand) => (
                <Badge key={brand.brand_id} tone="blue">
                  {brand.parent_brand_id ? `${hub.companyBrands.find((item) => item.brand_id === brand.parent_brand_id)?.name ?? ""} › ` : ""}
                  {brand.name}
                </Badge>
              ))}
            </div>
          </div>
          {canEdit ? (
            <Button type="button" variant="outline" size="lg" onClick={() => setSettingsOpen(true)}>
              <Pencil className={styles.icon} aria-hidden />
              Edit project
            </Button>
          ) : null}
        </div>
        {project.description ? <p className={styles.description}>{project.description}</p> : null}
      </header>

      {hubUnavailable ? (
        <p className={styles.notice} role="status">
          Strategy, KPIs, and brands need the Supabase database. They are hidden until <code>ATM_DATA_MODE=supabase</code> is configured.
        </p>
      ) : null}

      <Tabs items={tabs} value={tab} onValueChange={setTab} aria-label="Project sections" />

      {tab === "overview" ? <ProjectOverview {...props} /> : null}
      {tab === "social" ? <ProjectSocialDashboard project={project} hub={hub} canEdit={canEdit} /> : null}
      {tab === "content" ? <ProjectContentMatrix project={project} hub={hub} tasks={props.tasks} canContribute={props.canContribute} /> : null}
      {tab === "files" ? <ProjectFilesPanel {...props} /> : null}

      {canEdit && settingsOpen ? (
        <ProjectSettingsModal
          onClose={() => setSettingsOpen(false)}
          project={project}
          users={props.users}
          hub={hub}
          hubUnavailable={hubUnavailable}
        />
      ) : null}
    </div>
  );
}
