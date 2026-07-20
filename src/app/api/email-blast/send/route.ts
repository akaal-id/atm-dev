import { NextResponse, type NextRequest } from "next/server";

import { createEmailLog } from "@/lib/server/email-blast-logs";
import { createEmailBlastWithRecipients } from "@/lib/server/email-blasts";
import { getCurrentUser } from "@/lib/server/auth";
import { isResendConfigured, sendBlastEmail } from "@/lib/server/resend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const subject = String(payload.subject ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const attachmentUrls = (
    Array.isArray(payload.attachment_urls)
      ? payload.attachment_urls
      : payload.attachment_url
        ? [payload.attachment_url]
        : []
  )
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
  const attachmentUrl = attachmentUrls[0];
  const rawRecipients = Array.isArray(payload.recipients) ? payload.recipients : [];
  const recipients = rawRecipients
    .map((entry) => String(entry ?? "").trim().toLowerCase())
    .filter(Boolean);

  if (!subject || !body) {
    return NextResponse.json({ error: "Subject and body are required." }, { status: 400 });
  }
  if (recipients.length === 0) {
    return NextResponse.json({ error: "At least one recipient is required." }, { status: 400 });
  }

  const invalid = recipients.filter((email) => !EMAIL_PATTERN.test(email));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid recipient email(s): ${invalid.join(", ")}` }, { status: 400 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json(
      {
        error: "Resend is not configured. Set RESEND_API_KEY in the environment.",
        configured: false,
      },
      { status: 503 },
    );
  }

  const result = await sendBlastEmail({
    recipients,
    subject,
    body,
    attachmentUrl,
    attachmentUrls,
  });

  let log = null;
  let blast = null;
  try {
    log = await createEmailLog({
      userId: user.user_id,
      subject,
      body,
      attachmentUrl,
      results: result.results,
      ok: result.ok,
    });
  } catch (error) {
    console.error("Failed to persist email_logs", error);
  }

  try {
    const saved = await createEmailBlastWithRecipients({
      userId: user.user_id,
      subject,
      body,
      attachmentUrl,
      results: result.results,
      ok: result.ok,
    });
    blast = saved.blast;
  } catch (error) {
    console.error("Failed to persist email_blasts", error);
  }

  return NextResponse.json({
    ok: result.ok,
    skipped: result.skipped ?? false,
    configured: true,
    sent_by: user.user_id,
    subject,
    recipient_count: result.results.length,
    results: result.results,
    log_id: log?.id ?? null,
    log_status: log?.status ?? null,
    blast_id: blast?.id ?? null,
    blast_status: blast?.status ?? null,
  });
}
