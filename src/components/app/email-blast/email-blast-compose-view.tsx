"use client";

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
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-normal tracking-normal text-foreground">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
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
    <label className="grid gap-2 text-sm font-normal text-foreground">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}

function mapGroups(rows: unknown[]): MockContactGroup[] {
  return rows.map((entry) => {
    const group = entry as {
      id: string;
      group_name: string;
      created_at: string;
      contacts?: Array<{ id: string; email: string; full_name: string; company?: string }>;
    };
    return {
      id: group.id,
      groupName: group.group_name,
      createdAt: group.created_at,
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
    const form = new FormData();
    form.append("subject", subject);
    form.append("body", body);
    form.append(
      "recipients",
      JSON.stringify(
        recipients.map((recipient) => ({
          email: recipient.email,
          contact_id: recipient.contactId,
          full_name: recipient.fullName,
          company: recipient.company,
        })),
      ),
    );
    for (const item of attachments) {
      form.append("attachments", item.file, item.file.name);
    }

    const response = await fetch("/api/email-blast/send", {
      method: "POST",
      body: form,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Gagal mengirim blast.");
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
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={formValid ? "green" : "blue"}>
                  <Mail className="mr-1 inline h-3.5 w-3.5" />
                  {formValid ? "Ready" : "Draft"}
                </Badge>
                <Link href="/email-blast/history" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10")}>
                  <History className="h-4 w-4" />
                  History
                </Link>
              </div>
            }
          />
        </CardHeader>
        <CardBody className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Tulis subjek dan isi pesan, lampirkan dokumen jika perlu, lalu pilih penerima sebelum mengirim blast.
          </p>

          <div className="grid min-w-0 gap-4">
            <div className="space-y-4 rounded-[2px] border border-border bg-card p-4">
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
                  className="input min-h-40 resize-y"
                  placeholder="Tulis isi pesan email di sini…"
                  rows={8}
                  aria-invalid={touched.body && Boolean(errors.body)}
                />
                <p className="text-xs font-normal text-muted-foreground">
                  Placeholder tersedia di subject &amp; body: <code className="rounded bg-muted px-1 py-0.5">[Nama Penerima]</code>{" "}
                  dan <code className="rounded bg-muted px-1 py-0.5">[Nama Perusahaan]</code> — otomatis diganti sesuai data
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
                <p className="mt-2 text-xs font-normal text-red-600">{errors.recipients}</p>
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
