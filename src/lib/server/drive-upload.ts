"use server";

import "server-only";
import { getCurrentUser } from "@/lib/server/auth";
import { headers } from "next/headers";

const MAX_CLIENT_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

type DriveActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function driveConfigError(): string | null {
  const missing: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  if (!process.env.GOOGLE_REFRESH_TOKEN) missing.push("GOOGLE_REFRESH_TOKEN");
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) missing.push("GOOGLE_DRIVE_FOLDER_ID");
  if (missing.length === 0) return null;
  return `Google Drive is not configured (missing: ${missing.join(", ")}). Add these env vars in Vercel and redeploy.`;
}

async function requestOrigin(): Promise<string> {
  const headersList = await headers();
  const forwardedHost = headersList.get("x-forwarded-host");
  const forwardedProto = headersList.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  const origin = headersList.get("origin");
  if (origin) return origin;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (appUrl) return appUrl.replace(/\/$/, "");
  return "http://localhost:3000";
}

// Fungsi baru untuk mendapatkan token langsung atas nama akun 2TB Anda
async function getAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error("GOOGLE OAUTH ERROR DETAIL:", data);
    throw new Error(
      `Google OAuth failed: ${data.error_description || data.error || "unknown error"}. Regenerate the refresh token if needed.`,
    );
  }
  return data.access_token;
}

export interface GenerateResumableUrlInput {
  fileName: string;
  mimeType: string;
  size: number;
  parentId?: string;
}

// Creates a subfolder under the configured Drive root and returns its id.
// Used when uploading a whole folder so every file lands inside one shared folder.
export async function createDriveFolder(name: string): Promise<DriveActionResult<{ folderId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You must be signed in to upload files." };

  const configError = driveConfigError();
  if (configError) return { ok: false, error: configError };

  const folderName = name.trim() || "Untitled folder";

  try {
    const token = await getAccessToken();
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const currentOrigin = await requestOrigin();

    const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        Origin: currentOrigin,
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Drive folder create failed:", res.status, detail);
      return { ok: false, error: `Drive folder creation failed (${res.status}). Check server logs.` };
    }

    const data = await res.json();
    if (!data.id) return { ok: false, error: "Drive did not return a folder id." };
    return { ok: true, data: { folderId: String(data.id) } };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to create folder.";
    console.error("createDriveFolder error:", cause);
    return { ok: false, error: message };
  }
}

export async function generateResumableUrl(
  input: GenerateResumableUrlInput,
): Promise<DriveActionResult<{ uploadUrl: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You must be signed in to upload files." };

  const configError = driveConfigError();
  if (configError) return { ok: false, error: configError };

  if (input.size <= 0) return { ok: false, error: "File is empty." };
  if (input.size > MAX_CLIENT_UPLOAD_BYTES) {
    return { ok: false, error: "File is too large." };
  }

  try {
    const token = await getAccessToken();
    const folderId = input.parentId?.trim() || process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const mimeType = input.mimeType || "application/octet-stream";
    const currentOrigin = await requestOrigin();

    const metadata = {
      name: input.fileName,
      parents: [folderId],
    };

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": String(input.size),
          Origin: currentOrigin,
        },
        body: JSON.stringify(metadata),
      },
    );

    if (!initRes.ok) {
      const detail = await initRes.text();
      console.error("Drive resumable init failed:", initRes.status, detail);
      return { ok: false, error: `Drive upload setup failed (${initRes.status}). Check server logs.` };
    }

    const location = initRes.headers.get("Location") ?? initRes.headers.get("location");
    if (!location) return { ok: false, error: "Drive did not return an upload URL." };

    return { ok: true, data: { uploadUrl: location } };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to prepare upload.";
    console.error("generateResumableUrl error:", cause);
    return { ok: false, error: message };
  }
}

export type CreateResumableUploadInput = GenerateResumableUrlInput;

export async function createResumableUpload(input: CreateResumableUploadInput) {
  return generateResumableUrl(input);
}

export interface FinalizeFilePermissionResult {
  webViewLink: string;
  webContentLink: string | null;
}

export async function finalizeFilePermission(
  fileId: string,
): Promise<DriveActionResult<FinalizeFilePermissionResult>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You must be signed in to upload files." };

  const configError = driveConfigError();
  if (configError) return { ok: false, error: configError };

  try {
    const token = await getAccessToken();

    const permRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "anyone", role: "reader" }),
      },
    );

    if (!permRes.ok) {
      console.error("Drive permission failed:", permRes.status, await permRes.text());
      return { ok: false, error: `Drive permission failed (${permRes.status}).` };
    }

    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=webViewLink,webContentLink`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );

    const file = await fileRes.json();
    return {
      ok: true,
      data: {
        webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
        webContentLink: file.webContentLink ?? null,
      },
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to finalize upload.";
    console.error("finalizeFilePermission error:", cause);
    return { ok: false, error: message };
  }
}