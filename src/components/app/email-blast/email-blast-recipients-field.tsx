"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ComposeRecipient = {
  email: string;
  /** Set when this recipient was added from a saved contact group — server re-fetches name/company by this ID. */
  contactId?: string;
  /** Manual-entry merge fields (ignored server-side when contactId is set). */
  fullName?: string;
  company?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseEmails(raw: string) {
  return raw
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

interface EmailBlastRecipientsFieldProps {
  recipients: ComposeRecipient[];
  onChange: (recipients: ComposeRecipient[]) => void;
}

/** Multi-email recipient chips — paste or type emails, with optional name/company for one-off manual recipients. */
export function EmailBlastRecipientsField({ recipients, onChange }: EmailBlastRecipientsFieldProps) {
  const [emailDraft, setEmailDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [companyDraft, setCompanyDraft] = useState("");
  const [error, setError] = useState("");

  function addEmails(raw: string) {
    const candidates = parseEmails(raw);
    if (candidates.length === 0) {
      setError("Masukkan minimal satu alamat email.");
      return;
    }

    const invalid = candidates.filter((email) => !EMAIL_PATTERN.test(email));
    if (invalid.length > 0) {
      setError(`Email tidak valid: ${invalid.join(", ")}`);
      return;
    }

    const existing = new Set(recipients.map((item) => item.email));
    const uniqueCandidates = [...new Set(candidates)];
    const name = nameDraft.trim();
    const company = companyDraft.trim();
    const additions = uniqueCandidates
      .filter((email) => !existing.has(email))
      .map((email, index) => ({
        email,
        // Manual name/company only make sense when adding exactly one recipient at a time.
        fullName: uniqueCandidates.length === 1 ? name : index === 0 ? name : "",
        company: uniqueCandidates.length === 1 ? company : index === 0 ? company : "",
      }));

    onChange([...recipients, ...additions]);
    setEmailDraft("");
    setNameDraft("");
    setCompanyDraft("");
    setError("");
  }

  function removeRecipient(email: string) {
    onChange(recipients.filter((item) => item.email !== email));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addEmails(emailDraft);
    }
    if (event.key === "Backspace" && !emailDraft && recipients.length > 0) {
      onChange(recipients.slice(0, -1));
    }
  }

  return (
    <div className="space-y-3 rounded-[2px] border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-normal text-foreground">Recipients</p>
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
            Ketik atau tempel banyak email (pisahkan dengan koma, spasi, atau Enter). Nama &amp; company opsional, hanya
            berlaku untuk satu email sekaligus.
          </p>
        </div>
        <Badge tone={recipients.length > 0 ? "blue" : "neutral"}>{recipients.length} recipients</Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          className="input"
          placeholder="Nama (opsional)"
          autoComplete="off"
        />
        <input
          type="text"
          value={companyDraft}
          onChange={(event) => setCompanyDraft(event.target.value)}
          className="input"
          placeholder="Company (opsional)"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={emailDraft}
          onChange={(event) => {
            setEmailDraft(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (emailDraft.trim()) addEmails(emailDraft);
          }}
          className="input flex-1"
          placeholder="nama@perusahaan.com, lain@akaal.id"
          autoComplete="off"
          inputMode="email"
        />
        <Button type="button" variant="outline" size="lg" className="h-10 shrink-0" onClick={() => addEmails(emailDraft)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {error ? <p className="text-sm font-normal text-red-600">{error}</p> : null}

      {recipients.length === 0 ? (
        <div className="rounded-[2px] border border-dashed border-border bg-surface-inset/80 px-4 py-5 text-center text-sm font-normal text-muted-foreground">
          Belum ada penerima. Tambahkan email untuk blast.
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {recipients.map((recipient) => (
            <li
              key={recipient.email}
              className="inline-flex max-w-full items-center gap-1.5 rounded-[2px] border border-border bg-surface-inset py-1.5 pl-2.5 pr-1"
            >
              <span className="truncate text-sm font-normal text-neutral-800">
                {recipient.fullName ? `${recipient.fullName} · ${recipient.email}` : recipient.email}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${recipient.email}`}
                onClick={() => removeRecipient(recipient.email)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
