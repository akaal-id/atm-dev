import { NextResponse, type NextRequest } from "next/server";

import { createEmailLog } from "@/lib/server/email-blast-logs";
import { createEmailBlastWithRecipients } from "@/lib/server/email-blasts";
import { listContactsByIdsForCompany } from "@/lib/server/email-blast-contacts";
import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import { isResendConfigured, sendBlastEmail, type BlastRecipient, type EmailAttachment } from "@/lib/server/resend";
import { fetchEmailBlastAttachment } from "@/lib/server/uploads";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RawRecipient = { email?: unknown; contact_id?: unknown; full_name?: unknown; company?: unknown };

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body_ = await request.json().catch(() => null);
  if (!body_) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const subject = String(body_.subject ?? "").trim();
  const body = String(body_.body ?? "").trim();
  const rawRecipients: RawRecipient[] = Array.isArray(body_.recipients) ? body_.recipients : [];
  const attachmentPath = String(body_.attachmentPath ?? "").trim();

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

  const companyContext = await getActiveCompanyContext(user.user_id);
  const companyId = companyContext.company.id;

  const contactIds = [...new Set(contactRecipients.map((entry) => String(entry.contact_id ?? "").trim()))];
  const contacts = contactIds.length > 0 ? await listContactsByIdsForCompany(companyId, contactIds) : [];
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
  if (attachmentPath) {
    const fetched = await fetchEmailBlastAttachment(attachmentPath);
    if (!fetched) {
      return NextResponse.json({ error: "Failed to load attachment from storage." }, { status: 502 });
    }
    attachments = [{ filename: fetched.filename, content: fetched.buffer.toString("base64") }];
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
      attachmentUrl: attachmentPath,
      results: result.results,
      ok: result.ok,
    });
  } catch (error) {
    console.error("Failed to persist email_logs", error);
  }

  try {
    const saved = await createEmailBlastWithRecipients({
      userId: user.user_id,
      companyId,
      subject,
      body,
      attachmentUrl: attachmentPath,
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
