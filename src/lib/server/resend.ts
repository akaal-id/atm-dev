import "server-only";

import type { AppNotification, User } from "@/lib/types";

interface ResendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  id?: string;
}

export type EmailAttachment = {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
};

interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  attachments?: EmailAttachment[];
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || "Akaal Team Management <onboarding@akaal.id>";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail({ to, subject, html, text, from, attachments }: TransactionalEmail): Promise<ResendResult> {
  if (!isResendConfigured()) return { ok: true, skipped: true };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: from || getFromEmail(),
      to: [to],
      subject,
      html,
      text,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, error: body.slice(0, 500) };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, id: payload?.id };
}

export type BlastRecipientResult = {
  email: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
  resendId?: string;
};

export type BlastRecipient = {
  email: string;
  /** Merge field for the [Nama Penerima] placeholder. */
  fullName?: string;
  /** Merge field for the [Nama Perusahaan] placeholder. */
  company?: string;
};

export type BlastEmailInput = {
  recipients: BlastRecipient[];
  subject: string;
  body: string;
  from?: string;
  attachments?: EmailAttachment[];
};

/** Replace the two supported blast merge fields with a recipient's data. */
function renderMergeFields(text: string, recipient: BlastRecipient) {
  return text
    .replaceAll("[Nama Penerima]", recipient.fullName || "")
    .replaceAll("[Nama Perusahaan]", recipient.company || "");
}

function bodyToHtml(body: string, hasAttachments: boolean) {
  const htmlBody = escapeHtml(body).replaceAll("\n", "<br />");
  const attachmentNote = hasAttachments
    ? `<p style="margin:20px 0 0;color:#475569">Lihat lampiran pada email ini.</p>`
    : "";
  return `
    <div style="font-family:Plus Jakarta Sans, sans-serif;line-height:1.6;color:#0f172a">
      <p style="margin:0 0 16px">${htmlBody}</p>
      ${attachmentNote}
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Dikirim via Akaal Email Blast</p>
    </div>
  `;
}

/** Send one email per recipient via existing Resend config; merges [Nama Penerima]/[Nama Perusahaan] per address. */
export async function sendBlastEmail({
  recipients,
  subject,
  body,
  from,
  attachments,
}: BlastEmailInput): Promise<{ ok: boolean; skipped?: boolean; results: BlastRecipientResult[] }> {
  const uniqueRecipients = new Map<string, BlastRecipient>();
  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase();
    if (!email || uniqueRecipients.has(email)) continue;
    uniqueRecipients.set(email, { ...recipient, email });
  }
  const hasAttachments = Boolean(attachments && attachments.length > 0);

  if (!isResendConfigured()) {
    return {
      ok: true,
      skipped: true,
      results: [...uniqueRecipients.keys()].map((email) => ({ email, status: "skipped" as const })),
    };
  }

  const results: BlastRecipientResult[] = [];
  for (const recipient of uniqueRecipients.values()) {
    const personalizedSubject = renderMergeFields(subject, recipient);
    const personalizedBody = renderMergeFields(body, recipient);
    const html = bodyToHtml(personalizedBody, hasAttachments);
    const text = hasAttachments ? `${personalizedBody}\n\n(Lihat lampiran pada email ini.)` : personalizedBody;

    const result = await sendEmail({ to: recipient.email, subject: personalizedSubject, html, text, from, attachments });
    if (result.ok) {
      results.push({
        email: recipient.email,
        status: result.skipped ? "skipped" : "sent",
        resendId: result.id,
      });
    } else {
      results.push({ email: recipient.email, status: "failed", error: result.error });
    }
  }

  return {
    ok: results.every((item) => item.status !== "failed"),
    results,
  };
}

export async function sendNotificationEmail(notification: AppNotification, user?: User): Promise<ResendResult> {
  if (!user?.email) return { ok: true, skipped: true, error: "Notification user has no email." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const relatedUrl = notification.related_link ? new URL(notification.related_link, appUrl).toString() : appUrl;
  const title = escapeHtml(notification.title);
  const description = escapeHtml(notification.description);
  const safeRelatedUrl = escapeHtml(relatedUrl);

  return sendEmail({
    to: user.email,
    subject: notification.title,
    html: `
      <div style="font-family:Plus Jakarta Sans, sans-serif;line-height:1.6;color:#0f172a">
        <h1 style="font-size:20px;margin:0 0 12px">Akaal Team Management</h1>
        <p style="font-size:16px;margin:0 0 12px"><strong>${title}</strong></p>
        <p style="margin:0 0 20px;color:#475569">${description}</p>
        <a href="${safeRelatedUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">Open in ATM</a>
      </div>
    `,
    text: `${notification.title}\n\n${notification.description}\n\nOpen in ATM: ${relatedUrl}`,
  });
}
