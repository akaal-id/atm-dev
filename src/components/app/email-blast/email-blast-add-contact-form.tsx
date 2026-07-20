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
};

interface EmailBlastAddContactFormProps {
  groupName: string;
  busy?: boolean;
  onAdd: (contacts: NewContactInput[]) => Promise<void> | void;
}

/** Add one or more contacts to the selected group. */
export function EmailBlastAddContactForm({ groupName, busy = false, onAdd }: EmailBlastAddContactFormProps) {
  const [fullName, setFullName] = useState("");
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
    const contacts = emails.map((email, index) => ({
      email,
      fullName: emails.length === 1 ? name : index === 0 && name ? name : "",
    }));

    try {
      await onAdd(contacts);
      setFullName("");
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
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-slate-500" />
        <p className="text-sm font-semibold text-slate-700">Tambah kontak</p>
      </div>

      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
        Nama (opsional)
        <input
          type="text"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            if (error) setError("");
            if (success) setSuccess("");
          }}
          className="input h-10 text-sm font-medium"
          placeholder="Nama lengkap"
          autoComplete="name"
          disabled={busy}
        />
      </label>

      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
        Email
        <input
          type="text"
          value={emailDraft}
          onChange={(event) => {
            setEmailDraft(event.target.value);
            if (error) setError("");
            if (success) setSuccess("");
          }}
          className="input h-10 text-sm font-medium"
          placeholder="email@contoh.com atau beberapa email dipisah koma"
          autoComplete="email"
          disabled={busy}
          required
        />
      </label>

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      {success ? <p className="text-xs font-medium text-emerald-700">{success}</p> : null}

      <Button type="submit" variant="default" size="lg" className="h-10 w-full" disabled={busy}>
        <Plus className="h-4 w-4" />
        {busy ? "Menyimpan…" : "Tambah ke grup"}
      </Button>
    </form>
  );
}
