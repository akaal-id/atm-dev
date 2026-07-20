import "server-only";

import type { BlastRecipientResult } from "@/lib/server/resend";
import { makeId } from "@/lib/utils";

function supabaseUrl() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const explicitUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (explicitUrl || (projectId ? `https://${projectId}.supabase.co` : "")).replace(/\/$/, "");
}

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function headers(prefer = "return=representation") {
  const key = supabaseKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

export type EmailBlastRecord = {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  attachment_url: string;
  resend_batch_id: string;
  status: string;
  created_at: string;
};

export type BlastRecipientRecord = {
  id: string;
  blast_id: string;
  recipient_email: string;
  status: string;
  error: string;
  resend_id: string;
};

export async function createEmailBlastWithRecipients(input: {
  userId: string;
  subject: string;
  body: string;
  attachmentUrl?: string;
  results: BlastRecipientResult[];
  ok: boolean;
}): Promise<{ blast: EmailBlastRecord; recipients: BlastRecipientRecord[] }> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) throw new Error("Supabase is not configured.");

  const failed = input.results.some((item) => item.status === "failed");
  const skipped = input.results.every((item) => item.status === "skipped");
  const status = skipped ? "skipped" : failed ? (input.ok ? "partial" : "failed") : "sent";
  const firstResendId = input.results.find((item) => item.resendId)?.resendId || "";

  const blast: EmailBlastRecord = {
    id: makeId("blast"),
    user_id: input.userId,
    subject: input.subject,
    body: input.body,
    attachment_url: input.attachmentUrl || "",
    resend_batch_id: firstResendId,
    status,
    created_at: new Date().toISOString(),
  };

  const blastRes = await fetch(`${baseUrl}/rest/v1/email_blasts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(blast),
  });
  if (!blastRes.ok) {
    throw new Error(`Failed to save email_blasts (${blastRes.status})`);
  }

  const recipients: BlastRecipientRecord[] = input.results.map((item) => ({
    id: makeId("brcp"),
    blast_id: blast.id,
    recipient_email: item.email,
    status: item.status,
    error: item.error || "",
    resend_id: item.resendId || "",
  }));

  if (recipients.length > 0) {
    const recipientsRes = await fetch(`${baseUrl}/rest/v1/blast_recipients`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(recipients),
    });
    if (!recipientsRes.ok) {
      throw new Error(`Failed to save blast_recipients (${recipientsRes.status})`);
    }
  }

  return { blast, recipients };
}

export async function listEmailBlasts(userId: string, limit = 50) {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return [] as Array<EmailBlastRecord & { recipients: BlastRecipientRecord[] }>;

  const blastsRes = await fetch(
    `${baseUrl}/rest/v1/email_blasts?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=${limit}`,
    { headers: headers(), cache: "no-store" },
  );
  if (!blastsRes.ok) return [];
  const blasts = (await blastsRes.json()) as EmailBlastRecord[];
  if (blasts.length === 0) return [];

  const ids = blasts.map((blast) => blast.id);
  const recipientsRes = await fetch(
    `${baseUrl}/rest/v1/blast_recipients?blast_id=in.(${ids.map(encodeURIComponent).join(",")})&select=*`,
    { headers: headers(), cache: "no-store" },
  );
  const recipients = recipientsRes.ok ? ((await recipientsRes.json()) as BlastRecipientRecord[]) : [];

  return blasts.map((blast) => ({
    ...blast,
    recipients: recipients.filter((recipient) => recipient.blast_id === blast.id),
  }));
}

export async function getEmailBlast(id: string, userId?: string) {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return null;

  const filter = userId
    ? `id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`
    : `id=eq.${encodeURIComponent(id)}`;
  const blastRes = await fetch(`${baseUrl}/rest/v1/email_blasts?${filter}&select=*&limit=1`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!blastRes.ok) return null;
  const blasts = (await blastRes.json()) as EmailBlastRecord[];
  const blast = blasts[0];
  if (!blast) return null;

  const recipientsRes = await fetch(
    `${baseUrl}/rest/v1/blast_recipients?blast_id=eq.${encodeURIComponent(blast.id)}&select=*`,
    { headers: headers(), cache: "no-store" },
  );
  const recipients = recipientsRes.ok ? ((await recipientsRes.json()) as BlastRecipientRecord[]) : [];
  return { ...blast, recipients };
}
