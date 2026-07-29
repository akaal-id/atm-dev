"use client";

import { Plus, UserPlus } from "lucide-react";
import { useState } from "react";

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

export type NewContactInput = {
  email: string;
  fullName: string;
  company: string;
};

interface EmailBlastAddContactFormProps {
  groupName: string;
  busy?: boolean;
  onAdd: (contacts: NewContactInput[]) => Promise<void> | void;
}

/** Add one or more contacts to the selected group. */
export function EmailBlastAddContactForm({ groupName, busy = false, onAdd }: EmailBlastAddContactFormProps) {
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const emails = parseEmails(emailDraft);
    if (emails.length === 0) {
      setError("Masukkan minimal satu alamat email.");
      setSuccess("");
      return;
    }

    const invalid = emails.filter((email) => !EMAIL_PATTERN.test(email));
    if (invalid.length > 0) {
      setError(`Email tidak valid: ${invalid.join(", ")}`);
      setSuccess("");
      return;
    }

    const name = fullName.trim();
    const companyName = company.trim();
    const contacts = emails.map((email, index) => ({
      email,
      fullName: emails.length === 1 ? name : index === 0 && name ? name : "",
      company: emails.length === 1 ? companyName : index === 0 && companyName ? companyName : "",
    }));

    try {
      await onAdd(contacts);
      setFullName("");
      setCompany("");
      setEmailDraft("");
      setError("");
      setSuccess(
        emails.length === 1
          ? `Kontak ditambahkan ke "${groupName}".`
          : `${emails.length} kontak ditambahkan ke "${groupName}".`,
      );
    } catch (cause) {
      setSuccess("");
      setError(cause instanceof Error ? cause.message : "Gagal menambahkan kontak.");
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 rounded-[2px] border border-border bg-surface-inset/80 p-3">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-normal text-foreground">Tambah kontak</p>
      </div>

      <label className="grid gap-1.5 text-xs font-normal text-muted-foreground">
        Nama (opsional)
        <input
          type="text"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            if (error) setError("");
            if (success) setSuccess("");
          }}
          className="input h-10 text-sm font-normal"
          placeholder="Nama lengkap"
          autoComplete="name"
          disabled={busy}
        />
      </label>

      <label className="grid gap-1.5 text-xs font-normal text-muted-foreground">
        Company (opsional)
        <input
          type="text"
          value={company}
          onChange={(event) => {
            setCompany(event.target.value);
            if (error) setError("");
            if (success) setSuccess("");
          }}
          className="input h-10 text-sm font-normal"
          placeholder="Nama perusahaan"
          autoComplete="organization"
          disabled={busy}
        />
      </label>

      <label className="grid gap-1.5 text-xs font-normal text-muted-foreground">
        Email
        <input
          type="text"
          value={emailDraft}
          onChange={(event) => {
            setEmailDraft(event.target.value);
            if (error) setError("");
            if (success) setSuccess("");
          }}
          className="input h-10 text-sm font-normal"
          placeholder="email@contoh.com atau beberapa email dipisah koma"
          autoComplete="email"
          disabled={busy}
          required
        />
      </label>

      {error ? <p className="text-xs font-normal text-red-600">{error}</p> : null}
      {success ? <p className="text-xs font-normal text-emerald-700">{success}</p> : null}

      <Button type="submit" variant="default" size="lg" className="h-10 w-full" disabled={busy}>
        <Plus className="h-4 w-4" />
        {busy ? "Menyimpan…" : "Tambah ke grup"}
      </Button>
    </form>
  );
}
