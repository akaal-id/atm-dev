import "server-only";

import type { AppNotification, User } from "@/lib/types";

interface ResendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  id?: string;
}

interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
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

export async function sendEmail({ to, subject, html, text, from }: TransactionalEmail): Promise<ResendResult> {
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

export type BlastEmailInput = {
  recipients: string[];
  subject: string;
  body: string;
  from?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
};

function resolveAttachmentUrls(attachmentUrl?: string, attachmentUrls?: string[]) {
  const urls = [
    ...(attachmentUrls || []),
    ...(attachmentUrl ? [attachmentUrl] : []),
  ]
    .map((url) => url.trim())
    .filter(Boolean);
  return [...new Set(urls)];
}

function bodyToHtml(body: string, attachmentUrls: string[] = []) {
  const htmlBody = escapeHtml(body).replaceAll("\n", "<br />");
  const attachmentBlock =
    attachmentUrls.length > 0
      ? `<p style="margin:20px 0 0">${attachmentUrls
          .map(
            (url, index) =>
              `<a href="${escapeHtml(url)}" style="color:#2563eb;font-weight:700">Lihat lampiran${
                attachmentUrls.length > 1 ? ` ${index + 1}` : ""
              }</a>`,
          )
          .join("<br />")}</p>`
      : "";
  return `
    <div style="font-family:Plus Jakarta Sans, sans-serif;line-height:1.6;color:#0f172a">
      <p style="margin:0 0 16px">${htmlBody}</p>
      ${attachmentBlock}
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Dikirim via Akaal Email Blast</p>
    </div>
  `;
}

/** Send one email per recipient via existing Resend config; aggregates per-address status. */
export async function sendBlastEmail({
  recipients,
  subject,
  body,
  from,
  attachmentUrl,
  attachmentUrls,
}: BlastEmailInput): Promise<{ ok: boolean; skipped?: boolean; results: BlastRecipientResult[] }> {
  const uniqueRecipients = [...new Set(recipients.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const urls = resolveAttachmentUrls(attachmentUrl, attachmentUrls);
  const html = bodyToHtml(body, urls);
  const text = urls.length > 0 ? `${body}\n\nLampiran:\n${urls.join("\n")}` : body;

  if (!isResendConfigured()) {
    return {
      ok: true,
      skipped: true,
      results: uniqueRecipients.map((email) => ({ email, status: "skipped" as const })),
    };
  }

  const results: BlastRecipientResult[] = [];
  for (const email of uniqueRecipients) {
    const result = await sendEmail({ to: email, subject, html, text, from });
    if (result.ok) {
      results.push({
        email,
        status: result.skipped ? "skipped" : "sent",
        resendId: result.id,
      });
    } else {
      results.push({ email, status: "failed", error: result.error });
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
