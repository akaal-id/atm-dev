import "server-only";

import type { AppNotification, User } from "@/lib/types";

interface ResendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || "Akaal Team Management <onboarding@resend.dev>";
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

  return { ok: true };
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
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a">
        <h1 style="font-size:20px;margin:0 0 12px">Akaal Team Management</h1>
        <p style="font-size:16px;margin:0 0 12px"><strong>${title}</strong></p>
        <p style="margin:0 0 20px;color:#475569">${description}</p>
        <a href="${safeRelatedUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">Open in ATM</a>
      </div>
    `,
    text: `${notification.title}\n\n${notification.description}\n\nOpen in ATM: ${relatedUrl}`,
  });
}
