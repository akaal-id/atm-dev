import "server-only";

import { makeId } from "@/lib/utils";
import type { BlastRecipientResult } from "@/lib/server/resend";

function supabaseUrl() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const explicitUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (explicitUrl || (projectId ? `https://${projectId}.supabase.co` : "")).replace(/\/$/, "");
}

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export type EmailLogRecord = {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  attachment_url: string;
  recipient_count: number;
  status: string;
  results: BlastRecipientResult[];
  created_at: string;
};

export async function createEmailLog(input: {
  userId: string;
  subject: string;
  body: string;
  attachmentUrl?: string;
  results: BlastRecipientResult[];
  ok: boolean;
}): Promise<EmailLogRecord> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) {
    throw new Error("Supabase is not configured for email logs.");
  }

  const failed = input.results.some((item) => item.status === "failed");
  const skipped = input.results.every((item) => item.status === "skipped");
  const status = skipped ? "skipped" : failed ? (input.ok ? "partial" : "failed") : "sent";

  const record = {
    id: makeId("elog"),
    user_id: input.userId,
    subject: input.subject,
    body: input.body,
    attachment_url: input.attachmentUrl || "",
    recipient_count: input.results.length,
    status,
    results: input.results,
    created_at: new Date().toISOString(),
  };

  const response = await fetch(`${baseUrl}/rest/v1/email_logs`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    const preview = await response.text();
    throw new Error(`Failed to save email log (${response.status}): ${preview.slice(0, 300)}`);
  }

  const rows = (await response.json()) as EmailLogRecord[];
  return rows[0] ?? record;
}

export async function listEmailLogs(userId?: string, limit = 50): Promise<EmailLogRecord[]> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return [];

  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(limit),
  });
  if (userId) params.set("user_id", `eq.${userId}`);

  const response = await fetch(`${baseUrl}/rest/v1/email_logs?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return [];
  return (await response.json()) as EmailLogRecord[];
}

export async function getEmailLog(id: string): Promise<EmailLogRecord | null> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return null;

  const response = await fetch(`${baseUrl}/rest/v1/email_logs?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const rows = (await response.json()) as EmailLogRecord[];
  return rows[0] ?? null;
}
