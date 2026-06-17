"use client";

import { useCallback, useRef, useState } from "react";

// Hapus MAX_CLIENT_UPLOAD_BYTES dari import ini
import { finalizeFilePermission, generateResumableUrl } from "@/lib/server/drive-upload";

// Deklarasikan variabelnya secara lokal di sini untuk Frontend
const MAX_CLIENT_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export type DriveUploadStatus = "idle" | "preparing" | "uploading" | "finalizing" | "done" | "error";

export interface DriveUploadResult {
  webViewLink: string;
  webContentLink: string | null;
  fileName: string;
  fileMime: string;
}

function formatMaxSize() {
  return `${Math.floor(MAX_CLIENT_UPLOAD_BYTES / (1024 * 1024 * 1024))}GB`;
}

function putFileViaXhr(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
  abortSignal: AbortSignal,
): Promise<{ fileId: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const mimeType = file.type || "application/octet-stream";

    const onAbort = () => xhr.abort();
    abortSignal.addEventListener("abort", onAbort, { once: true });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });

    xhr.addEventListener("load", () => {
      abortSignal.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as { id?: string };
          if (!payload.id) {
            reject(new Error("Drive upload succeeded but no file ID was returned."));
            return;
          }
          resolve({ fileId: payload.id });
        } catch {
          reject(new Error("Drive returned an invalid upload response."));
        }
        return;
      }
      const detail = xhr.responseText.slice(0, 300);
      reject(new Error(`Drive upload failed (${xhr.status})${detail ? `: ${detail}` : "."}`));
    });

    xhr.addEventListener("error", () => {
      abortSignal.removeEventListener("abort", onAbort);
      if (!navigator.onLine) {
        reject(new Error("You appear to be offline. Reconnect and try again."));
        return;
      }
      reject(new Error("Network error during upload. Check your connection and try again."));
    });

    xhr.addEventListener("abort", () => {
      abortSignal.removeEventListener("abort", onAbort);
      reject(new Error("Upload cancelled."));
    });

    xhr.send(file);
  });
}

export function useDriveUpload() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<DriveUploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus("idle");
    setError(null);
    abortRef.current = null;
  }, []);

  const upload = useCallback(async (file: File): Promise<DriveUploadResult> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setProgress(0);
    setError(null);

    if (file.size <= 0) {
      const message = "File is empty.";
      setStatus("error");
      setError(message);
      throw new Error(message);
    }

    if (file.size > MAX_CLIENT_UPLOAD_BYTES) {
      const message = `File is too large (max ${formatMaxSize()}).`;
      setStatus("error");
      setError(message);
      throw new Error(message);
    }

    const fileMime = file.type || "application/octet-stream";

    try {
      setStatus("preparing");
      const prepare = await generateResumableUrl({
        fileName: file.name,
        mimeType: fileMime,
        size: file.size,
      });
      if (!prepare.ok) throw new Error(prepare.error);

      if (controller.signal.aborted) throw new Error("Upload cancelled.");

      setStatus("uploading");
      const { fileId } = await putFileViaXhr(prepare.data.uploadUrl, file, setProgress, controller.signal);

      if (controller.signal.aborted) throw new Error("Upload cancelled.");

      setStatus("finalizing");
      const finalize = await finalizeFilePermission(fileId);
      if (!finalize.ok) throw new Error(finalize.error);

      const { webViewLink, webContentLink } = finalize.data;

      setProgress(100);
      setStatus("done");

      return { webViewLink, webContentLink, fileName: file.name, fileMime };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Upload failed. Please try again.";
      setStatus("error");
      setError(message);
      throw cause instanceof Error ? cause : new Error(message);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, []);

  const isUploading = status === "preparing" || status === "uploading" || status === "finalizing";

  return { upload, cancel, reset, progress, status, error, isUploading };
}