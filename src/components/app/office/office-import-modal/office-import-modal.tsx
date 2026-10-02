"use client";

import styles from "./office-import-modal.module.css";

import { FileUp, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { OfficeLocationFields, PERSONAL } from "@/components/app/office/office-location-fields";
import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { importAccept, importTypeFor, MAX_IMPORT_BYTES } from "@/lib/office-import";
import { requestJson } from "@/lib/request-json";
import type { OfficeFile } from "@/lib/types/office";

const typeLabel = { sheet: "Spreadsheet", doc: "Document" } as const;

/**
 * Import .docx / .xlsx / .xls / .csv / .ods into a project (or personal notes).
 * Files are converted in the browser, then saved as Univer data. Mount only while open.
 */
export function OfficeImportModal({
  projects,
  foldersByProject,
  initialLocation,
  onClose,
}: {
  projects: Array<{ project_id: string; project_name: string }>;
  foldersByProject: Record<string, string[]>;
  initialLocation: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState(initialLocation);
  const [folder, setFolder] = useState("");
  const [status, setStatus] = useState<"idle" | "converting" | "saving">("idle");
  const [dragging, setDragging] = useState(false);
  const busy = status !== "idle";
  const detected = file ? importTypeFor(file.name) : null;

  function pick(next: File | undefined) {
    if (!next) return;
    if (!importTypeFor(next.name)) {
      pushToast({ tone: "error", title: "Unsupported file", description: "Use .docx, .xlsx, .xls, .csv, or .ods." });
      return;
    }
    if (next.size > MAX_IMPORT_BYTES) {
      pushToast({ tone: "error", title: "File is larger than 25 MB" });
      return;
    }
    setFile(next);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !location || busy) return;
    try {
      setStatus("converting");
      const { importOfficeFile } = await import("@/lib/office-import");
      const imported = await importOfficeFile(file);
      setStatus("saving");
      const isProject = location !== PERSONAL;
      const created = await requestJson<OfficeFile>("/api/office", "POST", {
        type: imported.type,
        title: imported.title,
        snapshot: imported.snapshot,
        ...(isProject ? { project_id: location, folder: folder.trim() } : { scope: "personal" }),
      });
      pushToast({
        tone: "success",
        title: `Imported “${imported.title}”`,
        description: imported.warnings.length ? `${imported.warnings.length} item(s) could not be converted exactly.` : undefined,
      });
      onClose();
      router.push(tenant.href(`/office/${created.file_id}`));
    } catch (error) {
      pushToast({ tone: "error", title: "Import failed", description: error instanceof Error ? error.message : "The file could not be read." });
      setStatus("idle");
    }
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title="Import file" eyebrow="Office" className={styles.panel}>
      <form className={styles.form} onSubmit={onSubmit}>
        <div
          className={dragging ? styles.dropActive : styles.drop}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files[0]);
          }}
        >
          {file ? (
            <div className={styles.selected}>
              <FileUp className={styles.fileIcon} aria-hidden />
              <div className={styles.fileText}>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.hint}>
                  {detected ? `Opens as ${typeLabel[detected]}` : ""} · {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFile(null)} aria-label="Remove file" disabled={busy}>
                <X className={styles.icon} />
              </Button>
            </div>
          ) : (
            <button type="button" className={styles.dropButton} onClick={() => inputRef.current?.click()}>
              <FileUp className={styles.fileIcon} aria-hidden />
              <span className={styles.fileName}>Choose a file or drop it here</span>
              <span className={styles.hint}>Word (.docx) · Excel (.xlsx, .xls, .csv, .ods) · up to 25 MB</span>
            </button>
          )}
          <input ref={inputRef} type="file" accept={importAccept} className={styles.hidden} onChange={(event) => pick(event.target.files?.[0])} />
        </div>

        <OfficeLocationFields
          projects={projects}
          foldersByProject={foldersByProject}
          location={location}
          folder={folder}
          onLocationChange={setLocation}
          onFolderChange={setFolder}
        />

        <p className={styles.hint}>
          Converted in your browser. Text, styles, tables, images, and formulas come across; charts, comments, and tracked changes do not.
        </p>

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!file || !location || busy}>
            {busy ? <Loader2 className={styles.spinner} aria-hidden /> : null}
            {status === "converting" ? "Converting…" : status === "saving" ? "Saving…" : "Import"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
