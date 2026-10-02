"use client";

import styles from "./office-new-file-modal.module.css";

import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import { OfficeLocationFields, PERSONAL } from "@/components/app/office/office-location-fields";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { requestJson } from "@/lib/request-json";
import type { OfficeFile, OfficeFileType } from "@/lib/types/office";
import { cn } from "@/lib/utils";

/**
 * Create a sheet or doc. A location is mandatory: a project the user contributes to,
 * or their personal notes. Mount only while open.
 */
export function OfficeNewFileModal({
  projects,
  foldersByProject,
  initialLocation,
  onClose,
}: {
  projects: Array<{ project_id: string; project_name: string }>;
  foldersByProject: Record<string, string[]>;
  /** `personal`, a project id, or "" to force a choice. */
  initialLocation: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();
  const [type, setType] = useState<OfficeFileType>("sheet");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState(initialLocation);
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const isProject = Boolean(location) && location !== PERSONAL;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !location || busy) return;
    setBusy(true);
    try {
      const file = await requestJson<OfficeFile>("/api/office", "POST", {
        type,
        title: title.trim(),
        ...(isProject ? { project_id: location, folder: folder.trim() } : { scope: "personal" }),
      });
      onClose();
      router.push(tenant.href(`/office/${file.file_id}`));
    } catch (error) {
      pushToast({ tone: "error", title: "Could not create file", description: error instanceof Error ? error.message : "Something went wrong." });
      setBusy(false);
    }
  }

  const typeOptions: Array<{ value: OfficeFileType; label: string; hint: string; icon: typeof FileText }> = [
    { value: "sheet", label: "Spreadsheet", hint: "Univer sheet, export to Excel", icon: FileSpreadsheet },
    { value: "doc", label: "Document", hint: "Pages or pageless, DOCX / PDF", icon: FileText },
  ];

  return (
    <Modal open onClose={() => !busy && onClose()} title="New file" eyebrow="Office" className={styles.panel}>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.types} role="radiogroup" aria-label="File type">
          {typeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={type === option.value}
              className={cn(styles.type, type === option.value && styles.typeActive)}
              onClick={() => setType(option.value)}
            >
              <option.icon className={styles.typeIcon} aria-hidden />
              <span className={styles.typeLabel}>{option.label}</span>
              <span className={styles.hint}>{option.hint}</span>
            </button>
          ))}
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Title</span>
          <input className="input" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === "sheet" ? "e.g. Budget plan Q4" : "e.g. Meeting notes 2 Oct"} maxLength={200} />
        </label>

        <OfficeLocationFields
          projects={projects}
          foldersByProject={foldersByProject}
          location={location}
          folder={folder}
          onLocationChange={setLocation}
          onFolderChange={setFolder}
        />

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !title.trim() || !location}>
            {busy ? <Loader2 className={styles.spinner} aria-hidden /> : null}
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
