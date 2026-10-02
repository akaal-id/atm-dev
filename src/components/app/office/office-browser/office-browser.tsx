"use client";

import styles from "./office-browser.module.css";

import { FileSpreadsheet, FileText, FileUp, Folder, FolderKanban, Layers, Lock, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { OfficeImportModal } from "@/components/app/office/office-import-modal";
import { PERSONAL } from "@/components/app/office/office-location-fields";
import { OfficeNewFileModal } from "@/components/app/office/office-new-file-modal";
import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import type { OfficeFileSummary } from "@/lib/types/office";
import { cn, formatShortDate } from "@/lib/utils";

const ALL = "all";

type ProjectEntry = { project_id: string; project_name: string; canContribute: boolean };

export function OfficeBrowser({
  files,
  projects,
  userNames,
  initialLocation,
}: {
  files: OfficeFileSummary[];
  projects: ProjectEntry[];
  userNames: Record<string, string>;
  /** `all`, `personal`, or a project id (from `?location=`). */
  initialLocation: string;
}) {
  const tenant = useTenant();
  const [location, setLocationState] = useState(initialLocation);
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const projectName = new Map(projects.map((project) => [project.project_id, project.project_name]));
  const contributable = projects.filter((project) => project.canContribute);
  const foldersByProject: Record<string, string[]> = {};
  for (const file of files) {
    if (file.scope === "project" && file.project_id && file.folder) {
      const list = (foldersByProject[file.project_id] ??= []);
      if (!list.includes(file.folder)) list.push(file.folder);
    }
  }

  function setLocation(next: string) {
    setLocationState(next);
    setFolder(null);
    const url = new URL(window.location.href);
    if (next === ALL) url.searchParams.delete("location");
    else url.searchParams.set("location", next);
    window.history.replaceState(window.history.state, "", url);
  }

  const inLocation = files.filter((file) =>
    location === ALL ? true : location === PERSONAL ? file.scope === "personal" : file.scope === "project" && file.project_id === location,
  );
  const folders = location !== ALL && location !== PERSONAL ? (foldersByProject[location] ?? []).sort() : [];
  const needle = query.trim().toLowerCase();
  const visible = inLocation
    .filter((file) => (folder === null ? true : file.folder === folder))
    .filter((file) => !needle || file.title.toLowerCase().includes(needle))
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

  const locationTitle = location === ALL ? "All files" : location === PERSONAL ? "Personal notes" : projectName.get(location) ?? "Project";
  const canCreateHere = location === ALL || location === PERSONAL || contributable.some((project) => project.project_id === location);
  const countFor = (key: string) =>
    files.filter((file) => (key === PERSONAL ? file.scope === "personal" : file.scope === "project" && file.project_id === key)).length;

  return (
    <div className={styles.root}>
      <nav className={styles.sidebar} aria-label="Office locations">
        <button type="button" className={cn(styles.location, location === ALL && styles.locationActive)} onClick={() => setLocation(ALL)}>
          <Layers className={styles.icon} aria-hidden />
          <span className={styles.locationName}>All files</span>
          <span className={styles.count}>{files.length}</span>
        </button>
        <button type="button" className={cn(styles.location, location === PERSONAL && styles.locationActive)} onClick={() => setLocation(PERSONAL)}>
          <Lock className={styles.icon} aria-hidden />
          <span className={styles.locationName}>Personal notes</span>
          <span className={styles.count}>{countFor(PERSONAL)}</span>
        </button>
        <p className={styles.sidebarHeading}>Projects</p>
        {projects.map((project) => (
          <button
            key={project.project_id}
            type="button"
            className={cn(styles.location, location === project.project_id && styles.locationActive)}
            onClick={() => setLocation(project.project_id)}
          >
            <FolderKanban className={styles.icon} aria-hidden />
            <span className={styles.locationName}>{project.project_name}</span>
            <span className={styles.count}>{countFor(project.project_id)}</span>
          </button>
        ))}
      </nav>

      <section className={styles.main} aria-label={locationTitle}>
        <div className={styles.toolbar}>
          <div className={styles.heading}>
            <h2 className={styles.title}>{locationTitle}</h2>
            {location === PERSONAL ? <p className={styles.hint}>Only you can see these files.</p> : null}
            {location !== ALL && location !== PERSONAL ? (
              <Link href={tenant.href(`/projects/${location}`)} className={styles.projectLink}>
                Open project dashboard
              </Link>
            ) : null}
          </div>
          <label className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden />
            <input className="input" placeholder="Search files" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {canCreateHere ? (
            <>
              <Button type="button" variant="outline" onClick={() => setImporting(true)}>
                <FileUp className={styles.icon} aria-hidden />
                Import
              </Button>
              <Button type="button" onClick={() => setCreating(true)}>
                <Plus className={styles.icon} aria-hidden />
                New file
              </Button>
            </>
          ) : null}
        </div>

        {folders.length > 0 ? (
          <div className={styles.folders} role="tablist" aria-label="Folders">
            <button type="button" role="tab" aria-selected={folder === null} className={cn(styles.folder, folder === null && styles.folderActive)} onClick={() => setFolder(null)}>
              All
            </button>
            {folders.map((name) => (
              <button key={name} type="button" role="tab" aria-selected={folder === name} className={cn(styles.folder, folder === name && styles.folderActive)} onClick={() => setFolder(name)}>
                <Folder className={styles.folderIcon} aria-hidden />
                {name}
              </button>
            ))}
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className={styles.empty}>
            <p>{inLocation.length === 0 ? "No files here yet." : "No files match your search."}</p>
            {canCreateHere && inLocation.length === 0 ? (
              <Button type="button" variant="outline" onClick={() => setCreating(true)}>
                <Plus className={styles.icon} aria-hidden />
                Create the first file
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className={styles.list}>
            {visible.map((file) => {
              const Icon = file.type === "sheet" ? FileSpreadsheet : FileText;
              const where = file.scope === "personal" ? "Personal notes" : [projectName.get(file.project_id ?? "") ?? "Project", file.folder].filter(Boolean).join(" / ");
              return (
                <li key={file.file_id}>
                  <Link href={tenant.href(`/office/${file.file_id}`)} className={styles.file}>
                    <Icon className={file.type === "sheet" ? styles.sheetIcon : styles.docIcon} aria-hidden />
                    <span className={styles.fileText}>
                      <span className={styles.fileTitle}>{file.title}</span>
                      <span className={styles.fileMeta}>
                        {where} · {file.type === "sheet" ? "Spreadsheet" : "Document"}
                      </span>
                    </span>
                    <span className={styles.fileUpdated}>
                      {formatShortDate(file.updated_at)}
                      <span className={styles.fileMeta}>{userNames[file.updated_by] ?? ""}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {importing ? (
        <OfficeImportModal
          projects={contributable}
          foldersByProject={foldersByProject}
          initialLocation={location === ALL ? "" : location}
          onClose={() => setImporting(false)}
        />
      ) : null}
      {creating ? (
        <OfficeNewFileModal
          projects={contributable}
          foldersByProject={foldersByProject}
          initialLocation={location === ALL ? "" : location}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  );
}
