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
  const isEmailBlast = fieldName.includes("email_blast") || fieldName.includes("blast_attachment");

  return {
    folder: isProfilePhoto ? "profile-photos" : isEmailBlast ? "email-blast" : "attachments",
    maxBytes: isProfilePhoto ? 5 * 1024 * 1024 : 10 * 1024 * 1024,
    allowedMimeTypes: isProfilePhoto ? imageMimeTypes : attachmentMimeTypes,
    bucket: isEmailBlast ? emailBlastBucketName() : bucketName(),
    public: !isEmailBlast,
  };
}

export function emailBlastBucketName() {
  return process.env.SUPABASE_EMAIL_BLAST_BUCKET || "email-blast-attachments";
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

const bucketPromises = new Map<string, Promise<void>>();

async function ensureUploadBucket(bucket = bucketName(), allowedMimeTypes = attachmentMimeTypes, isPublic = true) {
  const cacheKey = `${bucket}:${isPublic}`;
  const existing = bucketPromises.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const baseUrl = supabaseUrl();
    const check = await fetch(`${baseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
      cache: "no-store",
      headers: uploadHeaders(),
    });

    if (check.ok) {
      const current = (await check.json().catch(() => null)) as { public?: boolean } | null;
      if (current && current.public !== isPublic) {
        // Bucket exists but its visibility drifted from what this field requires (e.g. was created
        // public before this field switched to private) — correct it in place rather than leaving
        // files under the wrong access policy.
        const update = await fetch(`${baseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
          method: "PUT",
          headers: uploadHeaders(),
          body: JSON.stringify({
            id: bucket,
            public: isPublic,
            file_size_limit: 10 * 1024 * 1024,
            allowed_mime_types: allowedMimeTypes,
          }),
        });
        if (!update.ok) {
          throw new UploadError(`Could not update Supabase Storage bucket visibility. Status ${update.status}.`);
        }
      }
      return;
    }

    if (check.status !== 404) {
      throw new UploadError(`Could not verify Supabase Storage bucket. Status ${check.status}.`);
    }

    const create = await fetch(`${baseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: uploadHeaders(),
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: isPublic,
        file_size_limit: 10 * 1024 * 1024,
        allowed_mime_types: allowedMimeTypes,
      }),
    });

    if (!create.ok && create.status !== 409) {
      throw new UploadError(`Could not create Supabase Storage bucket. Status ${create.status}.`);
    }
  })().catch((error) => {
    bucketPromises.delete(cacheKey);
    throw error;
  });

  bucketPromises.set(cacheKey, promise);
  return promise;
}

export async function uploadFormFile(file: File, fieldName: string) {
  const config = uploadConfigForField(fieldName);

  if (!file.size) return "";
  if (file.size > config.maxBytes) {
    throw new UploadError(`File is too large. Maximum size is ${Math.round(config.maxBytes / 1024 / 1024)}MB.`);
  }
  const contentType = resolveMimeType(file, config.allowedMimeTypes);
  if (!contentType || !config.allowedMimeTypes.includes(contentType)) {
    throw new UploadError("Unsupported file type. Upload a JPG, PNG, WebP, GIF, PDF, or Word document.");
  }

  await ensureUploadBucket(config.bucket, config.allowedMimeTypes, config.public);

  const baseUrl = supabaseUrl();
  const bucket = config.bucket;
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

  return config.public ? `${baseUrl}/storage/v1/object/public/${bucket}/${path}` : path;
}

/**
 * Archive an email-blast attachment into the private bucket (history/audit only — the file itself
 * is sent to recipients as a real email attachment, never via this stored copy). Returns the
 * bucket-relative object path, not a URL, since the bucket has no public access.
 */
export async function archiveEmailBlastAttachment(file: File) {
  return uploadFormFile(file, "email_blast_attachment");
}

const EMAIL_BLAST_ATTACHMENT_MAX_BYTES = 30 * 1024 * 1024;

/**
 * Issue a signed upload URL so the browser can upload directly to Supabase Storage, bypassing the
 * Next.js API route entirely (Vercel serverless functions cap request bodies at ~4.5MB, well under
 * what email attachments need — direct-to-storage upload has no such limit).
 */
export async function createEmailBlastUploadUrl(fileName: string, fileSize: number, contentType: string) {
  if (fileSize > EMAIL_BLAST_ATTACHMENT_MAX_BYTES) {
    throw new UploadError(`File is too large. Maximum size is ${Math.round(EMAIL_BLAST_ATTACHMENT_MAX_BYTES / 1024 / 1024)}MB.`);
  }
  if (!attachmentMimeTypes.includes(contentType)) {
    throw new UploadError("Unsupported file type. Upload a JPG, PNG, WebP, GIF, PDF, or Word document.");
  }

  const bucket = emailBlastBucketName();
  await ensureUploadBucket(bucket, attachmentMimeTypes, false);

  const baseUrl = supabaseUrl();
  const extension = fileName.toLowerCase().includes(".") ? fileName.toLowerCase().split(".").pop() : extensionByMimeType[contentType];
  const path = `email-blast/${new Date().toISOString().slice(0, 10)}/${makeId("upl")}.${extension || "bin"}`;

  const response = await fetch(`${baseUrl}/storage/v1/object/upload/sign/${bucket}/${path}`, {
    method: "POST",
    headers: uploadHeaders(),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new UploadError(`Could not create signed upload URL. Status ${response.status}.`);
  }
  const payload = (await response.json().catch(() => null)) as { url?: string; token?: string } | null;
  if (!payload?.url || !payload?.token) {
    throw new UploadError("Signed upload URL response was missing a token.");
  }

  return {
    path,
    token: payload.token,
    uploadUrl: `${baseUrl}/storage/v1${payload.url}`,
  };
}

/** Fetch an email-blast attachment's bytes from the private bucket for attaching to an outbound email. */
export async function fetchEmailBlastAttachment(path: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return null;

  const bucket = emailBlastBucketName();
  const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, filename: path.split("/").pop() || "attachment" };
}

function parseStoredAttachmentRef(value: string): { bucket: string; path: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const publicUrlMatch = trimmed.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (publicUrlMatch) {
    return { bucket: publicUrlMatch[1], path: publicUrlMatch[2] };
  }
  if (/^https?:\/\//i.test(trimmed)) return null;

  return { bucket: emailBlastBucketName(), path: trimmed };
}

/**
 * Turn a stored attachment reference (bucket-relative path, or a legacy full public URL from
 * before the bucket was made private) into a short-lived signed URL for viewing in blast history.
 */
export async function signStoredEmailAttachment(value: string, expiresIn = 600): Promise<string | null> {
  const ref = parseStoredAttachmentRef(value);
  if (!ref) return null;

  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return null;

  const response = await fetch(
    `${baseUrl}/storage/v1/object/sign/${ref.bucket}/${ref.path}`,
    {
      method: "POST",
      headers: uploadHeaders(),
      body: JSON.stringify({ expiresIn }),
      cache: "no-store",
    },
  );
  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as { signedURL?: string } | null;
  if (!payload?.signedURL) return null;

  return `${baseUrl}/storage/v1${payload.signedURL.replace(/^\/storage\/v1/, "")}`;
}
