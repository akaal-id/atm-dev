"use client";

import styles from "./project-file-form.module.css";

import { FolderUp, Loader2, Paperclip, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DRIVE_FOLDER_MIME, useDriveUpload } from "@/hooks/useDriveUpload";

// folderName derives the top-level folder from a directory pick's relative paths.
function folderNameFromFiles(files: File[]) {
  for (const file of files) {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const top = relativePath?.split("/")[0];
    if (top) return top;
  }
  return "Uploaded folder";
}

export function ProjectFileForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { upload, uploadFolder, cancel, progress, status, error, isUploading, reset } = useDriveUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function saveRecord(payload: { file_url: string; file_name: string; file_mime: string }) {
    setSaving(true);
    const response = await fetch("/api/resources/Project_Files", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ task_id: taskId, title: title.trim(), ...payload }),
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
      const { webViewLink, fileName, fileMime } = await upload(file);
      const ok = await saveRecord({ file_url: webViewLink, file_name: fileName, file_mime: fileMime });
      if (ok) {
        setTitle("");
        reset();
        router.refresh();
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
      const { webViewLink, folderName, fileCount } = await uploadFolder(files, name);
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

  return (
    <div className={styles.group}>
      <input
        className="input"
        placeholder="File / folder label (optional)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={busy}
      />

      <div className={styles.icon}>
        <Button type="button" variant="outline" size="xl" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {busy ? <Loader2 className={styles.spinner} /> : <UploadCloud className={styles.cancelButton} />}
          Upload file
        </Button>
        <Button type="button" variant="outline" size="xl" disabled={busy} onClick={() => folderInputRef.current?.click()}>
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
          A folder uploads as one Drive folder containing every file inside it.
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
