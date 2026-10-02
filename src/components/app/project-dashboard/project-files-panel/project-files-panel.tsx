"use client";

import styles from "./project-files-panel.module.css";

import { ExternalLink, FileSpreadsheet, FileText, FolderOpen, Paperclip } from "lucide-react";
import Link from "next/link";

import type { ProjectDashboardProps } from "@/components/app/project-dashboard/project-dashboard/project-dashboard";
import { ProjectSopEditor } from "@/components/app/project-dashboard/project-sop-editor";
import { ProjectFileForm } from "@/components/app/project-file-form";
import { useTenant } from "@/components/app/tenant-provider";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DRIVE_FOLDER_MIME } from "@/hooks/useDriveUpload";
import type { ProjectFile } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

function FileList({ files, userName, empty }: { files: ProjectFile[]; userName: (id: string) => string; empty: string }) {
  if (files.length === 0) return <p className={styles.empty}>{empty}</p>;

  return (
    <ul className={styles.files}>
      {files.map((file) => (
        <li key={file.file_id}>
          <a href={file.file_url} target="_blank" rel="noreferrer" className={styles.file}>
            {file.file_mime === DRIVE_FOLDER_MIME ? <FolderOpen className={styles.fileIcon} aria-hidden /> : <Paperclip className={styles.fileIcon} aria-hidden />}
            <span className={styles.fileText}>
              <span className={styles.fileTitle}>{file.title || file.file_name}</span>
              <span className={styles.fileMeta}>
                {file.task_id ? `${file.task_id} · ` : ""}
                {userName(file.owner_user_id)} · {formatShortDate(file.created_at)}
              </span>
            </span>
            <ExternalLink className={styles.openIcon} aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ProjectFilesPanel({ project, files, users, canEdit, officeFiles }: ProjectDashboardProps) {
  const tenant = useTenant();
  const names = new Map(users.map((user) => [user.user_id, user.full_name]));
  const userName = (id: string) => names.get(id) ?? "Unknown";
  const byNewest = (left: ProjectFile, right: ProjectFile) => right.created_at.localeCompare(left.created_at);
  const baseFiles = files.filter((file) => file.category === "base").sort(byNewest);
  const sopFiles = files.filter((file) => file.category === "sop").sort(byNewest);
  const taskFiles = files.filter((file) => !file.category || file.category === "general").sort(byNewest);

  return (
    <div className={styles.grid}>
      <Card>
        <CardHeader>
          <h2 className={styles.title}>Base files</h2>
          <p className={styles.subtitle}>Brand guidelines, brief, assets, and references every task in this project starts from</p>
        </CardHeader>
        <CardBody className={styles.body}>
          <FileList files={baseFiles} userName={userName} empty="No base files yet." />
          {canEdit ? <ProjectFileForm projectId={project.project_id} category="base" /> : null}
        </CardBody>
      </Card>

      <Card className={styles.sop}>
        <CardHeader>
          <h2 className={styles.title}>SOP</h2>
          <p className={styles.subtitle}>How this project is run — steps, approvals, and checklists</p>
        </CardHeader>
        <CardBody className={styles.body}>
          <ProjectSopEditor projectId={project.project_id} content={project.sop_content ?? ""} canEdit={canEdit} />
          <div className={styles.attachments}>
            <h3 className={styles.sectionTitle}>SOP attachments</h3>
            <FileList files={sopFiles} userName={userName} empty="No SOP attachments." />
            {canEdit ? <ProjectFileForm projectId={project.project_id} category="sop" /> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>Office files · {officeFiles.length}</h2>
            <p className={styles.subtitle}>Sheets and docs filed under this project</p>
          </div>
          <Link href={tenant.href(`/office?location=${project.project_id}`)} className={styles.link}>
            Open in Office
          </Link>
        </CardHeader>
        <CardBody>
          {officeFiles.length === 0 ? (
            <p className={styles.empty}>No Office files yet.</p>
          ) : (
            <ul className={styles.files}>
              {officeFiles.slice(0, 8).map((file) => (
                <li key={file.file_id}>
                  <Link href={tenant.href(`/office/${file.file_id}`)} className={styles.file}>
                    {file.type === "sheet" ? <FileSpreadsheet className={styles.fileIcon} aria-hidden /> : <FileText className={styles.fileIcon} aria-hidden />}
                    <span className={styles.fileText}>
                      <span className={styles.fileTitle}>{file.title}</span>
                      <span className={styles.fileMeta}>
                        {file.folder ? `${file.folder} · ` : ""}
                        {userName(file.updated_by)} · {formatShortDate(file.updated_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>Task files · {taskFiles.length}</h2>
            <p className={styles.subtitle}>Uploaded from this project&apos;s tasks</p>
          </div>
          <Link href={tenant.href(`/project-files?project=${project.project_id}`)} className={styles.link}>
            Open all
          </Link>
        </CardHeader>
        <CardBody>
          <FileList files={taskFiles.slice(0, 8)} userName={userName} empty="No task files yet." />
        </CardBody>
      </Card>
    </div>
  );
}
