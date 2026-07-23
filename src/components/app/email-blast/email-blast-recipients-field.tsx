"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  recipients: string[];
  onChange: (recipients: string[]) => void;
}

/** Multi-email recipient chips — paste or type emails separated by comma/space/enter. */
export function EmailBlastRecipientsField({ recipients, onChange }: EmailBlastRecipientsFieldProps) {
  const [draft, setDraft] = useState("");
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

    const merged = [...recipients];
    for (const email of candidates) {
      if (!merged.includes(email)) merged.push(email);
    }
    onChange(merged);
    setDraft("");
    setError("");
  }

  function removeRecipient(email: string) {
    onChange(recipients.filter((item) => item !== email));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addEmails(draft);
    }
    if (event.key === "Backspace" && !draft && recipients.length > 0) {
      onChange(recipients.slice(0, -1));
    }
  }

  return (
    <div className="space-y-3 rounded-[2px] border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-normal text-foreground">Recipients</p>
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
            Ketik atau tempel banyak email (pisahkan dengan koma, spasi, atau Enter).
          </p>
        </div>
        <Badge tone={recipients.length > 0 ? "blue" : "neutral"}>{recipients.length} recipients</Badge>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) addEmails(draft);
          }}
          className="input flex-1"
          placeholder="nama@perusahaan.com, lain@akaal.id"
          autoComplete="off"
          inputMode="email"
        />
        <Button type="button" variant="outline" size="lg" className="h-10 shrink-0" onClick={() => addEmails(draft)}>
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
          {recipients.map((email) => (
            <li
              key={email}
              className="inline-flex max-w-full items-center gap-1.5 rounded-[2px] border border-border bg-surface-inset py-1.5 pl-2.5 pr-1"
            >
              <span className="truncate text-sm font-normal text-neutral-800">{email}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${email}`}
                onClick={() => removeRecipient(email)}
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
