"use client";

import styles from "./email-blast-compose-view.module.css";

import { History, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  EmailBlastAttachmentField,
  type EmailBlastAttachment,
} from "@/components/app/email-blast/email-blast-attachment-field";
import {
  isEmailBlastFormValid,
  validateEmailBlastForm,
} from "@/components/app/email-blast/email-blast-form-validation";
import {
  EmailBlastRecipientsField,
  type ComposeRecipient,
} from "@/components/app/email-blast/email-blast-recipients-field";
import { EmailBlastGroupPicker } from "@/components/app/email-blast/email-blast-group-picker";
import { EmailBlastResultNotice } from "@/components/app/email-blast/email-blast-result-notice";
import {
  EmailBlastSendButton,
  type SendResult,
} from "@/components/app/email-blast/email-blast-send-button";
import { Page } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { MockContactGroup } from "@/lib/data/email-blast-contacts-mock";
import { cn } from "@/lib/utils";

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className={styles.title}>
      <h2 className={styles.heading}>{title}</h2>
      {action ? <div className={styles.region}>{action}</div> : null}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.label}>
      <span>{label}</span>
      {children}
      {error ? <span className={styles.caption}>{error}</span> : null}
    </label>
  );
}

function mapGroups(rows: unknown[]): MockContactGroup[] {
  return rows.map((entry) => {
    const group = entry as {
      id: string;
      group_name: string;
      created_at: string;
      created_by?: { user_id?: string; full_name?: string };
      contacts?: Array<{ id: string; email: string; full_name: string; company?: string }>;
    };
    return {
      id: group.id,
      groupName: group.group_name,
      createdAt: group.created_at,
      createdBy: group.created_by?.user_id
        ? {
            userId: group.created_by.user_id,
            fullName: group.created_by.full_name || group.created_by.user_id,
          }
        : undefined,
      contacts: (group.contacts || []).map((contact) => ({
        id: contact.id,
        email: contact.email,
        fullName: contact.full_name,
        company: contact.company || "",
      })),
    };
  });
}

/** Main compose workspace for email blast. */
export function EmailBlastComposeView() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<EmailBlastAttachment[]>([]);
  const [recipients, setRecipients] = useState<ComposeRecipient[]>([]);
  const [groups, setGroups] = useState<MockContactGroup[]>([]);
  const [result, setResult] = useState<SendResult | null>(null);
  const [touched, setTouched] = useState({ subject: false, body: false, recipients: false });

  useEffect(() => {
    void fetch("/api/email-blast/contact-groups", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setGroups(mapGroups(Array.isArray(payload?.data) ? payload.data : [])))
      .catch(() => setGroups([]));
  }, []);

  const attachmentTotalBytes = useMemo(
    () => attachments.reduce((sum, item) => sum + item.file.size, 0),
    [attachments],
  );
  const formValues = useMemo(
    () => ({ subject, body, recipientCount: recipients.length, attachmentTotalBytes }),
    [subject, body, recipients.length, attachmentTotalBytes],
  );
  const errors = validateEmailBlastForm(formValues);
  const formValid = isEmailBlastFormValid(formValues);

  async function handleSend() {
    let attachmentPath = "";
    const file = attachments[0]?.file;
    if (file) {
      const urlResponse = await fetch("/api/email-blast/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type }),
      });
      const urlPayload = await urlResponse.json().catch(() => null);
      if (!urlResponse.ok) {
        throw new Error(urlPayload?.error || "Gagal menyiapkan unggahan lampiran.");
      }

      const uploadResponse = await fetch(urlPayload.data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error("Gagal mengunggah lampiran ke storage.");
      }
      attachmentPath = urlPayload.data.path;
    }

    const response = await fetch("/api/email-blast/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject,
        body,
        recipients: recipients.map((recipient) => ({
          email: recipient.email,
          contact_id: recipient.contactId,
          full_name: recipient.fullName,
          company: recipient.company,
        })),
        attachmentPath,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Gagal mengirim blast.");
    }
    if (!payload?.ok) {
      const failed = (payload?.results ?? []).filter((item: { status: string }) => item.status === "failed");
      const detail = failed[0]?.error ? `${failed[0].email}: ${failed[0].error}` : "Semua penerima gagal dikirim.";
      throw new Error(
        failed.length > 0 ? `${failed.length} dari ${payload.recipient_count} penerima gagal. ${detail}` : detail,
      );
    }
  }

  return (
    <Page>
      {result ? (
        <EmailBlastResultNotice status={result.status} message={result.message} onDismiss={() => setResult(null)} />
      ) : null}

      <Card>
        <CardHeader>
          <SectionTitle
            title="Compose email blast"
            action={
              <div className={styles.header}>
                <Badge tone={formValid ? "green" : "blue"}>
                  <Mail className={styles.icon} />
                  {formValid ? "Ready" : "Draft"}
                </Badge>
                <Link href="/email-blast/history" className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.item)}>
                  <History className={styles.glyph} />
                  History
                </Link>
              </div>
            }
          />
        </CardHeader>
        <CardBody className={styles.body}>
          <p className={styles.itemDescription}>
            Tulis subjek dan isi pesan, lampirkan dokumen jika perlu, lalu pilih penerima sebelum mengirim blast.
          </p>

          <div className={styles.bodyDiv}>
            <div className={styles.bodyPrimary}>
              <Field label="Subject" error={touched.subject ? errors.subject : undefined}>
                <input
                  name="subject"
                  type="text"
                  required
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, subject: true }))}
                  className="input"
                  placeholder="Judul email blast"
                  autoComplete="off"
                  aria-invalid={touched.subject && Boolean(errors.subject)}
                />
              </Field>
              <Field label="Body" error={touched.body ? errors.body : undefined}>
                <textarea
                  name="body"
                  required
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, body: true }))}
                  className={cn("input", styles.bodyField)}
                  placeholder="Tulis isi pesan email di sini…"
                  rows={8}
                  aria-invalid={touched.body && Boolean(errors.body)}
                />
                <p className={styles.errortext}>
                  Placeholder tersedia di subject &amp; body: <code className={styles.code}>[Nama Penerima]</code>{" "}
                  dan <code className={styles.code}>[Nama Perusahaan]</code> — otomatis diganti sesuai data
                  kontak tiap penerima saat dikirim.
                </p>
              </Field>
            </div>

            <EmailBlastAttachmentField attachments={attachments} onChange={setAttachments} error={errors.attachments} />

            <EmailBlastGroupPicker
              groups={groups}
              onApplyGroup={(contacts) => {
                setRecipients((current) => {
                  const merged = [...current];
                  const existing = new Set(merged.map((item) => item.email));
                  for (const contact of contacts) {
                    const email = contact.email.toLowerCase();
                    if (existing.has(email)) continue;
                    existing.add(email);
                    merged.push({ email, contactId: contact.id, fullName: contact.fullName, company: contact.company });
                  }
                  return merged;
                });
                setTouched((current) => ({ ...current, recipients: true }));
              }}
            />

            <div onBlurCapture={() => setTouched((current) => ({ ...current, recipients: true }))}>
              <EmailBlastRecipientsField recipients={recipients} onChange={setRecipients} />
              {touched.recipients && errors.recipients ? (
                <p className={styles.text}>{errors.recipients}</p>
              ) : null}
            </div>

            <EmailBlastSendButton
              recipientCount={recipients.length}
              attachmentCount={attachments.length}
              formValid={formValid}
              onSend={handleSend}
              onResult={setResult}
            />
          </div>
        </CardBody>
      </Card>
    </Page>
  );
}
