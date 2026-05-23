import "server-only";

import { makeId } from "@/lib/utils";

const imageMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const attachmentMimeTypes = [
  ...imageMimeTypes,
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

function supabaseUrl() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const explicitUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (explicitUrl || (projectId ? `https://${projectId}.supabase.co` : "")).replace(/\/$/, "");
}

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function bucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET || "atm-uploads";
}

function uploadHeaders(contentType = "application/json") {
  const key = supabaseKey();
  if (!supabaseUrl() || !key) {
    throw new UploadError("Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": contentType,
  };
}

function uploadConfigForField(fieldName: string) {
  const isProfilePhoto = fieldName.includes("profile_photo");

  return {
    folder: isProfilePhoto ? "profile-photos" : "attachments",
    maxBytes: isProfilePhoto ? 5 * 1024 * 1024 : 10 * 1024 * 1024,
    allowedMimeTypes: isProfilePhoto ? imageMimeTypes : attachmentMimeTypes,
  };
}

const extensionByFileName: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

function fileExtension(file: File) {
  const cleanName = file.name.toLowerCase().split("?")[0] ?? "";
  const extension = cleanName.includes(".") ? cleanName.split(".").pop() : "";
  return extension || extensionByMimeType[file.type] || "bin";
}

function resolveMimeType(file: File, allowedMimeTypes: string[]) {
  if (file.type && allowedMimeTypes.includes(file.type)) return file.type;

  const extension = fileExtension(file);
  const inferred = extensionByFileName[extension];
  if (inferred && allowedMimeTypes.includes(inferred)) return inferred;

  return file.type;
}

let bucketPromise: Promise<void> | null = null;

async function ensureUploadBucket() {
  if (!bucketPromise) {
    bucketPromise = (async () => {
      const baseUrl = supabaseUrl();
      const bucket = bucketName();
      const check = await fetch(`${baseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
        cache: "no-store",
        headers: uploadHeaders(),
      });

      if (check.ok) return;

      if (check.status !== 404) {
        throw new UploadError(`Could not verify Supabase Storage bucket. Status ${check.status}.`);
      }

      const create = await fetch(`${baseUrl}/storage/v1/bucket`, {
        method: "POST",
        headers: uploadHeaders(),
        body: JSON.stringify({
          id: bucket,
          name: bucket,
          public: true,
          file_size_limit: 10 * 1024 * 1024,
          allowed_mime_types: attachmentMimeTypes,
        }),
      });

      if (!create.ok && create.status !== 409) {
        throw new UploadError(`Could not create Supabase Storage bucket. Status ${create.status}.`);
      }
    })().catch((error) => {
      bucketPromise = null;
      throw error;
    });
  }

  return bucketPromise;
}

export async function uploadFormFile(file: File, fieldName: string) {
  const config = uploadConfigForField(fieldName);

  if (!file.size) return "";
  if (file.size > config.maxBytes) {
    throw new UploadError(`File is too large. Maximum size is ${Math.round(config.maxBytes / 1024 / 1024)}MB.`);
  }
  const contentType = resolveMimeType(file, config.allowedMimeTypes);
  if (!contentType || !config.allowedMimeTypes.includes(contentType)) {
    throw new UploadError("Unsupported file type. Upload a JPG, PNG, WebP, GIF, or HEIC image.");
  }

  await ensureUploadBucket();

  const baseUrl = supabaseUrl();
  const bucket = bucketName();
  const path = `${config.folder}/${new Date().toISOString().slice(0, 10)}/${makeId("upl")}.${fileExtension(file)}`;
  const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      ...uploadHeaders(contentType),
      "cache-control": "3600",
      "x-upsert": "false",
    },
    body: Buffer.from(await file.arrayBuffer()),
  });

  if (!response.ok) {
    const preview = await response.text();
    throw new UploadError(`Supabase upload failed. Status ${response.status}. ${preview.slice(0, 180)}`);
  }

  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
