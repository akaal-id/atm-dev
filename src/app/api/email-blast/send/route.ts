import { NextResponse, type NextRequest } from "next/server";

import { MAX_ATTACHMENT_TOTAL_BYTES } from "@/components/app/email-blast/email-blast-form-validation";
import { createEmailLog } from "@/lib/server/email-blast-logs";
import { createEmailBlastWithRecipients } from "@/lib/server/email-blasts";
import { listContactsByIdsForUser } from "@/lib/server/email-blast-contacts";
import { getCurrentUser } from "@/lib/server/auth";
import { isResendConfigured, sendBlastEmail, type BlastRecipient, type EmailAttachment } from "@/lib/server/resend";
import { archiveEmailBlastAttachment, UploadError } from "@/lib/server/uploads";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RawRecipient = { email?: unknown; contact_id?: unknown; full_name?: unknown; company?: unknown };

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const subject = String(form.get("subject") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const rawRecipients: RawRecipient[] = (() => {
    try {
      const parsed = JSON.parse(String(form.get("recipients") ?? "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const files = form.getAll("attachments").filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!subject || !body) {
    return NextResponse.json({ error: "Subject and body are required." }, { status: 400 });
  }
  if (rawRecipients.length === 0) {
    return NextResponse.json({ error: "At least one recipient is required." }, { status: 400 });
  }

  const contactRecipients = rawRecipients.filter((entry) => String(entry.contact_id ?? "").trim());
  const manualRecipients = rawRecipients.filter((entry) => !String(entry.contact_id ?? "").trim());

  const manualEmails = manualRecipients.map((entry) => String(entry.email ?? "").trim().toLowerCase());
  const invalidManual = manualEmails.filter((email) => !EMAIL_PATTERN.test(email));
  if (invalidManual.length > 0) {
    return NextResponse.json({ error: `Invalid recipient email(s): ${invalidManual.join(", ")}` }, { status: 400 });
  }

  const contactIds = [...new Set(contactRecipients.map((entry) => String(entry.contact_id ?? "").trim()))];
  const contacts = contactIds.length > 0 ? await listContactsByIdsForUser(user.user_id, contactIds) : [];
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));

  const resolved = new Map<string, BlastRecipient>();
  for (const entry of contactRecipients) {
    const contact = contactById.get(String(entry.contact_id ?? "").trim());
    if (!contact) continue;
    const email = contact.email.trim().toLowerCase();
    if (!email || resolved.has(email)) continue;
    resolved.set(email, { email, fullName: contact.full_name || "", company: contact.company || "" });
  }
  for (const entry of manualRecipients) {
    const email = String(entry.email ?? "").trim().toLowerCase();
    if (!email || resolved.has(email)) continue;
    resolved.set(email, {
      email,
      fullName: String(entry.full_name ?? "").trim(),
      company: String(entry.company ?? "").trim(),
    });
  }

  const recipients = [...resolved.values()];
  if (recipients.length === 0) {
    return NextResponse.json({ error: "At least one valid recipient is required." }, { status: 400 });
  }

  const totalAttachmentBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalAttachmentBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
    return NextResponse.json(
      { error: `Total attachment size exceeds ${Math.round(MAX_ATTACHMENT_TOTAL_BYTES / 1024 / 1024)}MB.` },
      { status: 400 },
    );
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

  let attachments: EmailAttachment[] = [];
  let attachmentArchivePath = "";
  try {
    attachments = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return { filename: file.name, content: buffer.toString("base64") };
      }),
    );
    if (files[0]) {
      attachmentArchivePath = await archiveEmailBlastAttachment(files[0]);
    }
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("email-blast attachment processing failed", error);
    return NextResponse.json({ error: "Failed to process attachment(s)." }, { status: 502 });
  }

  const result = await sendBlastEmail({
    recipients,
    subject,
    body,
    attachments,
  });

  let log = null;
  let blast = null;
  try {
    log = await createEmailLog({
      userId: user.user_id,
      subject,
      body,
      attachmentUrl: attachmentArchivePath,
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
      attachmentUrl: attachmentArchivePath,
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
