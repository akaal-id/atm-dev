"use client";

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
    <div className="space-y-3 rounded-lg border border-dashed border-slate-200 p-3">
      <input
        className="input"
        placeholder="File / folder label (optional)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={busy}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="xl" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Upload file
        </Button>
        <Button type="button" variant="outline" size="xl" disabled={busy} onClick={() => folderInputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderUp className="h-4 w-4" />}
          Upload folder
        </Button>
      </div>

      {isUploading ? (
        <div className="space-y-1" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {status === "preparing" ? "Preparing upload…" : status === "finalizing" ? "Finalizing…" : `Uploading… ${progress}%`}
            </span>
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1 text-slate-500 transition hover:text-red-600"
              aria-label="Cancel upload"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-150"
              style={{ width: `${status === "uploading" ? progress : status === "finalizing" ? 100 : 8}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Paperclip className="h-3.5 w-3.5" />
          A folder uploads as one Drive folder containing every file inside it.
        </p>
      )}

      {(formError || (error && !isUploading)) ? (
        <p className="text-xs font-semibold text-red-600" role="alert">
          {formError || error}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
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
