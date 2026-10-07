"use server";

import "server-only";
import { getCurrentUser } from "@/lib/server/auth";
import { getResourceById } from "@/lib/server/store";
import { cleanDriveName, DRIVE_CATEGORIES, driveDatePrefix, isDriveCategory } from "@/lib/drive-categories";
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
// Access tokens last ~1 h: reuse one per server instance instead of exchanging on every call.
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;
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
  cachedAccessToken = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

// ---- Folder routing: Main Akaal 2026 / <Category> / <Project> / <Subfolder> / DDMMYY_<name> ----

/** Where an upload belongs: a task (its project + workflow) or a project directly (Files & SOP panel). */
export interface UploadTarget {
  taskId?: string;
  projectId?: string;
  /** Project-level file kind (general | base | sop) — picks the default subfolder. */
  fileCategory?: string;
  /** Subfolder inside the project folder; defaults to the task's workflow name. */
  subfolder?: string;
}

const PROJECT_FILE_SUBFOLDERS: Record<string, string> = { base: "Base Files", sop: "SOP", general: "General" };
const folderIdCache = new Map<string, string>();
const driveQuote = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findFolder(token: string, parentId: string, name: string) {
  const cacheKey = `${parentId}/${name}`;
  const cached = folderIdCache.get(cacheKey);
  if (cached) return cached;
  const q = `'${driveQuote(parentId)}' in parents and name = '${driveQuote(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Drive folder lookup failed (${res.status}).`);
  const id = ((await res.json()) as { files?: Array<{ id: string }> }).files?.[0]?.id ?? null;
  if (id) folderIdCache.set(cacheKey, id);
  return id;
}

async function createFolderIn(token: string, parentId: string, name: string) {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!res.ok) throw new Error(`Could not create Drive folder "${name}" (${res.status}).`);
  return ((await res.json()) as { id: string }).id;
}

async function findOrCreateFolder(token: string, parentId: string, name: string) {
  const existing = await findFolder(token, parentId, name);
  if (existing) return existing;
  const id = await createFolderIn(token, parentId, name);
  folderIdCache.set(`${parentId}/${name}`, id);
  return id;
}

type TargetInfo = { projectId: string; projectName: string; categoryFolder: string | null; defaultSubfolder: string };

async function describeTarget(target: UploadTarget): Promise<DriveActionResult<TargetInfo>> {
  let projectId = target.projectId?.trim() ?? "";
  let defaultSubfolder = PROJECT_FILE_SUBFOLDERS[target.fileCategory ?? ""] ?? "General";
  if (target.taskId) {
    const task = await getResourceById("Tasks", target.taskId);
    if (!task) return { ok: false, error: "Task not found." };
    projectId = task.project_id || "";
    if (!projectId) return { ok: false, error: "This task has no project yet. Edit the task, choose its project, then upload." };
    const workflow = task.workflow_id ? await getResourceById("Workflows", task.workflow_id).catch(() => null) : null;
    defaultSubfolder = cleanDriveName(workflow?.name ?? "") || "General";
  }
  if (!projectId) return { ok: false, error: "Choose a project before uploading." };
  const project = await getResourceById("Projects", projectId);
  if (!project) return { ok: false, error: "Project not found." };
  const category = DRIVE_CATEGORIES.find((item) => item.value === project.drive_category);
  return {
    ok: true,
    data: { projectId, projectName: cleanDriveName(project.project_name) || projectId, categoryFolder: category?.folder ?? null, defaultSubfolder },
  };
}

const NO_CATEGORY_ERROR = "Set this project's Drive folder (Client, Company, Event or Internal Brand) in Edit project first.";

/** Resolves (creating as needed) Main Akaal 2026 / <Category> / <Project> / <Subfolder>. */
async function resolveTargetFolder(token: string, target: UploadTarget) {
  const info = await describeTarget(target);
  if (!info.ok) throw new Error(info.error);
  if (!info.data.categoryFolder) throw new Error(NO_CATEGORY_ERROR);
  const root = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const categoryId = await findOrCreateFolder(token, root, info.data.categoryFolder);
  const projectFolderId = await findOrCreateFolder(token, categoryId, info.data.projectName);
  const subfolder = cleanDriveName(target.subfolder ?? "") || info.data.defaultSubfolder;
  return findOrCreateFolder(token, projectFolderId, subfolder);
}

export interface UploadContext {
  projectId: string;
  /** e.g. ["Client", "D-8 Halal Expo Indonesia"] — null category when the project has none yet. */
  category: string | null;
  projectName: string;
  defaultSubfolder: string;
  /** Subfolders already inside the project folder, for the picker. */
  subfolders: string[];
  /** "071026_" — today's prefix for uploaded names. */
  prefix: string;
}

/** For the upload form: where files will go. Database only (fast) — Drive suggestions come from listUploadSubfolders. */
export async function getUploadContext(target: UploadTarget): Promise<DriveActionResult<UploadContext>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You must be signed in to upload files." };
  const configError = driveConfigError();
  if (configError) return { ok: false, error: configError };
  try {
    const info = await describeTarget(target);
    if (!info.ok) return info;
    return {
      ok: true,
      data: { projectId: info.data.projectId, category: info.data.categoryFolder, projectName: info.data.projectName, defaultSubfolder: info.data.defaultSubfolder, subfolders: [], prefix: driveDatePrefix() },
    };
  } catch (cause) {
    console.error("getUploadContext error:", cause);
    return { ok: false, error: cause instanceof Error ? cause.message : "Could not load the upload folder." };
  }
}

/** Subfolders already inside the project's Drive folder (picker suggestions). Loaded after the form shows. */
export async function listUploadSubfolders(target: UploadTarget): Promise<DriveActionResult<string[]>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You must be signed in." };
  if (driveConfigError()) return { ok: true, data: [] };
  try {
    const info = await describeTarget(target);
    if (!info.ok || !info.data.categoryFolder) return { ok: true, data: [] };
    const token = await getAccessToken();
    const categoryId = await findFolder(token, process.env.GOOGLE_DRIVE_FOLDER_ID!, info.data.categoryFolder);
    const projectFolderId = categoryId ? await findFolder(token, categoryId, info.data.projectName) : null;
    if (!projectFolderId) return { ok: true, data: [] };
    const q = `'${driveQuote(projectFolderId)}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(name)&orderBy=name&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: true, data: [] };
    return { ok: true, data: (((await res.json()) as { files?: Array<{ name: string }> }).files ?? []).map((file) => file.name) };
  } catch (cause) {
    console.error("listUploadSubfolders error:", cause);
    return { ok: true, data: [] };
  }
}

export interface GenerateResumableUrlInput {
  fileName: string;
  mimeType: string;
  size: number;
  parentId?: string;
  /** Where the file belongs; the server picks the folder and adds the date prefix. */
  target?: UploadTarget;
}

// Creates a subfolder under the configured Drive root and returns its id.
// Used when uploading a whole folder so every file lands inside one shared folder.
export async function createDriveFolder(name: string, target?: UploadTarget): Promise<DriveActionResult<{ folderId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You must be signed in to upload files." };

  const configError = driveConfigError();
  if (configError) return { ok: false, error: configError };

  const baseName = cleanDriveName(name) || "Untitled folder";

  try {
    const token = await getAccessToken();
    // Routed uploads land in Category / Project / Subfolder as "DDMMYY_<name>".
    const rootFolderId = target ? await resolveTargetFolder(token, target) : process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const folderName = target ? `${driveDatePrefix()}${baseName}` : baseName;
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
    // Inside an uploaded folder (parentId) files keep their names; a single routed file gets the date prefix.
    const parentId = input.parentId?.trim();
    const folderId = parentId || (input.target ? await resolveTargetFolder(token, input.target) : process.env.GOOGLE_DRIVE_FOLDER_ID!);
    const fileName = !parentId && input.target ? `${driveDatePrefix()}${input.fileName}` : input.fileName;
    const mimeType = input.mimeType || "application/octet-stream";
    const currentOrigin = await requestOrigin();

    const metadata = {
      name: fileName,
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