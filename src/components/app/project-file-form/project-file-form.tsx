"use client";

import styles from "./project-file-form.module.css";

import { FolderTree, FolderUp, Loader2, Paperclip, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DRIVE_FOLDER_MIME, useDriveUpload } from "@/hooks/useDriveUpload";
import { DRIVE_CATEGORIES } from "@/lib/drive-categories";
import { getUploadContext, listUploadSubfolders, type UploadContext } from "@/lib/server/drive-upload";
import type { ProjectFileCategory } from "@/lib/types";

// folderName derives the top-level folder from a directory pick's relative paths.
function folderNameFromFiles(files: File[]) {
  for (const file of files) {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const top = relativePath?.split("/")[0];
    if (top) return top;
  }
  return "Uploaded folder";
}

type ProjectFileFormProps =
  | { taskId: string; projectId?: undefined; category?: undefined }
  | { taskId?: undefined; projectId: string; category: ProjectFileCategory };

/** Upload to Drive and record a project file — for a task, or directly on a project (base file / SOP). */
export function ProjectFileForm({ taskId, projectId, category }: ProjectFileFormProps) {
  const router = useRouter();
  const { upload, uploadFolder, cancel, progress, status, error, isUploading, reset } = useDriveUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Where uploads go: Main Akaal 2026 / <Category> / <Project> / <Subfolder> / DDMMYY_<name>.
  const baseTarget = useMemo(() => (taskId ? { taskId } : { projectId, fileCategory: category }), [taskId, projectId, category]);
  const [context, setContext] = useState<UploadContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [subfolder, setSubfolder] = useState("");
  const [pickedCategory, setPickedCategory] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const loadContext = useCallback(() => {
    void getUploadContext(baseTarget).then((result) => {
      if (!result.ok) {
        setContext(null);
        setContextError(result.error);
        return;
      }
      setContextError("");
      setContext(result.data);
      setSubfolder((current) => current || result.data.defaultSubfolder);
      // Existing Drive subfolders are only suggestions: fetch them without holding up the form.
      if (result.data.category) {
        void listUploadSubfolders(baseTarget).then((list) => {
          if (list.ok) setSuggestions(list.data);
        });
      }
    });
  }, [baseTarget]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const target = { ...baseTarget, subfolder: subfolder.trim() || context?.defaultSubfolder };

  async function saveCategory() {
    if (!context || !pickedCategory) return;
    setSavingCategory(true);
    setFormError("");
    const response = await fetch(`/api/projects/${context.projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ drive_category: pickedCategory }),
    }).catch(() => null);
    setSavingCategory(false);
    if (!response?.ok) {
      setFormError(response?.status === 403 ? "Only the project owner or a manager can set the Drive folder." : "Could not save the Drive folder.");
      return;
    }
    loadContext();
  }

  async function saveRecord(payload: { file_url: string; file_name: string; file_mime: string }) {
    setSaving(true);
    const response = await fetch("/api/resources/Project_Files", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ task_id: taskId ?? "", project_id: projectId, category, title: title.trim(), ...payload }),
    }).catch(() => null);

    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      setFormError(body?.error ? String(body.error) : "Could not save the project file.");
      return false;
    }
    return true;
  }

  function reportError(cause: unknown) {
    const message = cause instanceof Error ? cause.message : "Upload failed. Please try again.";
    if (!message.includes("cancelled")) {
      setFormError(message.includes("not configured") ? "Google Drive is not configured. Contact your admin." : message);
    }
  }

  async function handleFile(file: File) {
    setFormError("");
    try {
      const { webViewLink, fileName, fileMime } = await upload(file, target);
      const ok = await saveRecord({ file_url: webViewLink, file_name: fileName, file_mime: fileMime });
      if (ok) {
        setTitle("");
        reset();
        router.refresh();
        loadContext();
      }
    } catch (cause) {
      reportError(cause);
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleFolder(files: File[]) {
    setFormError("");
    try {
      const name = folderNameFromFiles(files);
      const { webViewLink, folderName, fileCount } = await uploadFolder(files, name, target);
      const ok = await saveRecord({
        file_url: webViewLink,
        file_name: `${folderName} (${fileCount} file${fileCount === 1 ? "" : "s"})`,
        file_mime: DRIVE_FOLDER_MIME,
      });
      if (ok) {
        setTitle("");
        reset();
        router.refresh();
      }
    } catch (cause) {
      reportError(cause);
    } finally {
      setSaving(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }

  const busy = isUploading || saving;
  const ready = Boolean(context?.category);

  return (
    <div className={styles.group}>
      {contextError ? (
        <p className={styles.errortext} role="alert">
          {contextError}
        </p>
      ) : !context ? (
        <p className={styles.destinationMuted}>
          <Loader2 className={styles.spinner} /> Loading…
        </p>
      ) : !context.category ? (
        <div className={styles.categoryPicker}>
          <p className={styles.destinationMuted}>Choose where this project&apos;s files live in Drive (Main Akaal 2026):</p>
          <div className={styles.categoryRow}>
            <select className="input" value={pickedCategory} onChange={(event) => setPickedCategory(event.target.value)} aria-label="Drive folder">
              <option value="">Select a folder…</option>
              {DRIVE_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <Button type="button" variant="default" size="lg" disabled={!pickedCategory || savingCategory} onClick={() => void saveCategory()}>
              {savingCategory ? <Loader2 className={styles.spinner} /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.destination}>
          <FolderTree className={styles.destinationIcon} aria-hidden />
          <span className={styles.destinationPath} title={`Main Akaal 2026 / ${context.category} / ${context.projectName}`}>
            {context.category} › {context.projectName} ›
          </span>
          <input
            className={styles.subfolderInput}
            list={`drive-subfolders-${taskId ?? projectId}`}
            value={subfolder}
            onChange={(event) => setSubfolder(event.target.value)}
            placeholder={context.defaultSubfolder}
            aria-label="Drive subfolder"
            disabled={busy}
          />
          <datalist id={`drive-subfolders-${taskId ?? projectId}`}>
            {[...new Set([context.defaultSubfolder, ...suggestions])].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <span className={styles.destinationHint}>Saved as {context.prefix}file name</span>
        </div>
      )}

      <input
        className="input"
        placeholder="File / folder label (optional)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={busy}
      />

      <div className={styles.icon}>
        <Button type="button" variant="outline" size="xl" disabled={busy || !ready} onClick={() => fileInputRef.current?.click()}>
          {busy ? <Loader2 className={styles.spinner} /> : <UploadCloud className={styles.cancelButton} />}
          Upload file
        </Button>
        <Button type="button" variant="outline" size="xl" disabled={busy || !ready} onClick={() => folderInputRef.current?.click()}>
          {busy ? <Loader2 className={styles.spinner} /> : <FolderUp className={styles.cancelButton} />}
          Upload folder
        </Button>
      </div>

      {isUploading ? (
        <div className={styles.region} role="status" aria-live="polite">
          <div className={styles.block}>
            <span>
              {status === "preparing" ? "Preparing upload…" : status === "finalizing" ? "Finalizing…" : `Uploading… ${progress}%`}
            </span>
            <button
              type="button"
              onClick={cancel}
              className={styles.button}
              aria-label="Cancel upload"
            >
              <X className={styles.cancelUpload} />
              Cancel
            </button>
          </div>
          <div className={styles.cancelButton}>
            <div
              className={styles.cancelUploadCancelUpload}
              style={{ width: `${status === "uploading" ? progress : status === "finalizing" ? 100 : 8}%` }}
            />
          </div>
        </div>
      ) : (
        <p className={styles.itemDescription}>
          <Paperclip className={styles.cancelUpload} />
          A folder uploads as one Drive folder (named {context?.prefix ?? "DDMMYY_"}folder name) with every file inside it.
        </p>
      )}

      {(formError || (error && !isUploading)) ? (
        <p className={styles.errortext} role="alert">
          {formError || error}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        className={styles.input}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        className={styles.input}
        // webkitdirectory turns this input into a folder picker; not in React's types.
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : [];
          if (files.length > 0) void handleFolder(files);
        }}
      />
    </div>
  );
}
