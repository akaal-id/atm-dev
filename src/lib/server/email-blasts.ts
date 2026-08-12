import "server-only";

import type { BlastRecipientResult } from "@/lib/server/resend";
import { getResendEmail } from "@/lib/server/resend";
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

export type CreatedByInfo = {
  user_id: string;
  full_name: string;
};

export type EmailBlastRecord = {
  id: string;
  user_id: string;
  company_id: string;
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

export type EmailBlastWithRecipients = EmailBlastRecord & {
  recipients: BlastRecipientRecord[];
  created_by?: CreatedByInfo;
};

const TERMINAL_RECIPIENT_STATUSES = new Set([
  "delivered",
  "bounced",
  "failed",
  "complained",
  "canceled",
  "suppressed",
  "skipped",
]);

async function lookupUsersByIds(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return map;

  const response = await fetch(
    `${baseUrl}/rest/v1/users?user_id=in.(${unique.map(encodeURIComponent).join(",")})&select=user_id,full_name`,
    { headers: headers(), cache: "no-store" },
  );
  if (!response.ok) return map;
  const rows = (await response.json()) as Array<{ user_id: string; full_name: string }>;
  for (const row of rows) {
    map.set(row.user_id, row.full_name || row.user_id);
  }
  return map;
}

function attachCreatedBy<T extends EmailBlastRecord>(
  blast: T,
  names: Map<string, string>,
): T & { created_by: CreatedByInfo } {
  return {
    ...blast,
    created_by: {
      user_id: blast.user_id,
      full_name: names.get(blast.user_id) || blast.user_id,
    },
  };
}

function computeBlastStatus(recipients: BlastRecipientRecord[]): string {
  if (recipients.length === 0) return "sent";
  const statuses = recipients.map((recipient) => recipient.status);
  if (statuses.every((status) => status === "skipped")) return "skipped";
  const failedLike = statuses.some((status) =>
    ["failed", "bounced", "complained", "canceled", "suppressed"].includes(status),
  );
  const successLike = statuses.some((status) =>
    ["sent", "delivered", "opened", "clicked", "queued", "scheduled", "delivery_delayed"].includes(status),
  );
  if (failedLike && successLike) return "partial";
  if (failedLike && !successLike) return "failed";
  if (statuses.some((status) => status === "pending" || status === "queued" || status === "delivery_delayed")) {
    return "pending";
  }
  return "sent";
}

export async function createEmailBlastWithRecipients(input: {
  userId: string;
  companyId: string;
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
    company_id: input.companyId,
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

export async function listEmailBlasts(companyId: string, limit = 50): Promise<EmailBlastWithRecipients[]> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return [];

  const blastsRes = await fetch(
    `${baseUrl}/rest/v1/email_blasts?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=created_at.desc&limit=${limit}`,
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
  const names = await lookupUsersByIds(blasts.map((blast) => blast.user_id));

  return blasts.map((blast) =>
    attachCreatedBy(
      {
        ...blast,
        recipients: recipients.filter((recipient) => recipient.blast_id === blast.id),
      },
      names,
    ),
  );
}

export async function getEmailBlast(id: string, companyId: string): Promise<EmailBlastWithRecipients | null> {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return null;

  const blastRes = await fetch(
    `${baseUrl}/rest/v1/email_blasts?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`,
    {
      headers: headers(),
      cache: "no-store",
    },
  );
  if (!blastRes.ok) return null;
  const blasts = (await blastRes.json()) as EmailBlastRecord[];
  const blast = blasts[0];
  if (!blast) return null;

  const recipientsRes = await fetch(
    `${baseUrl}/rest/v1/blast_recipients?blast_id=eq.${encodeURIComponent(blast.id)}&select=*`,
    { headers: headers(), cache: "no-store" },
  );
  const recipients = recipientsRes.ok ? ((await recipientsRes.json()) as BlastRecipientRecord[]) : [];
  const names = await lookupUsersByIds([blast.user_id]);

  return attachCreatedBy({ ...blast, recipients }, names);
}

async function patchRecipientStatus(recipientId: string, status: string) {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return;

  await fetch(`${baseUrl}/rest/v1/blast_recipients?id=eq.${encodeURIComponent(recipientId)}`, {
    method: "PATCH",
    headers: headers("return=minimal"),
    body: JSON.stringify({ status }),
  });
}

async function patchBlastStatus(blastId: string, status: string) {
  const baseUrl = supabaseUrl();
  const key = supabaseKey();
  if (!baseUrl || !key) return;

  await fetch(`${baseUrl}/rest/v1/email_blasts?id=eq.${encodeURIComponent(blastId)}`, {
    method: "PATCH",
    headers: headers("return=minimal"),
    body: JSON.stringify({ status }),
  });
}

/** Poll Resend for non-terminal recipients and persist last_event into DB. */
export async function refreshBlastStatusesFromResend(
  blast: EmailBlastWithRecipients,
): Promise<EmailBlastWithRecipients> {
  const candidates = blast.recipients.filter(
    (recipient) => recipient.resend_id && !TERMINAL_RECIPIENT_STATUSES.has(recipient.status),
  );
  if (candidates.length === 0) return blast;

  const updatedRecipients = [...blast.recipients];
  const concurrency = 5;

  for (let index = 0; index < candidates.length; index += concurrency) {
    const chunk = candidates.slice(index, index + concurrency);
    const results = await Promise.all(
      chunk.map(async (recipient) => {
        const email = await getResendEmail(recipient.resend_id);
        const lastEvent = email?.last_event?.trim();
        if (!lastEvent || lastEvent === recipient.status) return null;
        await patchRecipientStatus(recipient.id, lastEvent);
        return { id: recipient.id, status: lastEvent };
      }),
    );

    for (const result of results) {
      if (!result) continue;
      const target = updatedRecipients.find((recipient) => recipient.id === result.id);
      if (target) target.status = result.status;
    }
  }

  const nextStatus = computeBlastStatus(updatedRecipients);
  if (nextStatus !== blast.status) {
    await patchBlastStatus(blast.id, nextStatus);
  }

  return {
    ...blast,
    status: nextStatus,
    recipients: updatedRecipients,
  };
}
