"use server";

import "server-only";
import { getCurrentUser } from "@/lib/server/auth";
import { headers } from "next/headers";

const MAX_CLIENT_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

function isDriveConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );
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
    throw new Error(`Google OAuth Error: ${data.error_description || data.error}. Cek terminal VS Code Anda.`);
  }
  return data.access_token;
}

export interface GenerateResumableUrlInput {
  fileName: string;
  mimeType: string;
  size: number;
}

export async function generateResumableUrl(
  input: GenerateResumableUrlInput,
): Promise<{ uploadUrl: string }> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Unauthorized");

  if (!isDriveConfigured()) {
    throw new Error("Google Drive OAuth is not configured in .env");
  }

  if (input.size <= 0) throw new Error("File is empty.");
  if (input.size > MAX_CLIENT_UPLOAD_BYTES) {
    throw new Error(`File is too large.`);
  }

  const token = await getAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const mimeType = input.mimeType || "application/octet-stream";

  const headersList = await headers();
  const currentOrigin = headersList.get("origin") || "http://localhost:3000";

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
        "Origin": currentOrigin,
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!initRes.ok) {
    const detail = await initRes.text();
    throw new Error(`Drive resumable init failed (${initRes.status}): ${detail}`);
  }

  const location = initRes.headers.get("Location") ?? initRes.headers.get("location");
  if (!location) throw new Error("Drive did not return a resumable session URL.");

  return { uploadUrl: location };
}

export type CreateResumableUploadInput = GenerateResumableUrlInput;

export async function createResumableUpload(input: CreateResumableUploadInput) {
  return generateResumableUrl(input);
}

export interface FinalizeFilePermissionResult {
  webViewLink: string;
  webContentLink: string | null;
}

export async function finalizeFilePermission(fileId: string): Promise<FinalizeFilePermissionResult> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Unauthorized");

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
    throw new Error(`Drive permission failed (${permRes.status})`);
  }

  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=webViewLink,webContentLink`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  
  const file = await fileRes.json();
  return {
    webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: file.webContentLink ?? null,
  };
}