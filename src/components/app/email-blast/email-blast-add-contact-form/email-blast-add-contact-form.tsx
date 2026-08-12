"use client";

import styles from "./email-blast-add-contact-form.module.css";

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
    <form onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
      <div className={styles.icon}>
        <UserPlus className={styles.iconUserplus} />
        <p className={styles.itemDescription}>Tambah kontak</p>
      </div>

      <label className={styles.label}>
        Nama (opsional)
        <input
          type="text"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            if (error) setError("");
            if (success) setSuccess("");
          }}
          className="input"
          placeholder="Nama lengkap"
          autoComplete="name"
          disabled={busy}
        />
      </label>

      <label className={styles.label}>
        Company (opsional)
        <input
          type="text"
          value={company}
          onChange={(event) => {
            setCompany(event.target.value);
            if (error) setError("");
            if (success) setSuccess("");
          }}
          className="input"
          placeholder="Nama perusahaan"
          autoComplete="organization"
          disabled={busy}
        />
      </label>

      <label className={styles.label}>
        Email
        <input
          type="text"
          value={emailDraft}
          onChange={(event) => {
            setEmailDraft(event.target.value);
            if (error) setError("");
            if (success) setSuccess("");
          }}
          className="input"
          placeholder="email@contoh.com atau beberapa email dipisah koma"
          autoComplete="email"
          disabled={busy}
          required
        />
      </label>

      {error ? <p className={styles.errortext}>{error}</p> : null}
      {success ? <p className={styles.text}>{success}</p> : null}

      <Button type="submit" variant="default" size="lg" className={styles.button} disabled={busy}>
        <Plus className={styles.iconPlus} />
        {busy ? "Menyimpan…" : "Tambah ke grup"}
      </Button>
    </form>
  );
}
