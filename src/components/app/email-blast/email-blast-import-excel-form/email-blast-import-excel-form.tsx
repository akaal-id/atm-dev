"use client";

import styles from "./email-blast-import-excel-form.module.css";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";

import type { NewContactInput } from "@/components/app/email-blast/email-blast-add-contact-form";
import { Button } from "@/components/ui/button";
import { parseContactsFromExcelFile } from "@/lib/email-blast-excel-contacts";

interface EmailBlastImportExcelFormProps {
  groupName: string;
  busy?: boolean;
  onAdd: (contacts: NewContactInput[]) => Promise<void> | void;
}

/** Upload Excel/CSV (nama | email) and add parsed contacts to the group. */
export function EmailBlastImportExcelForm({ groupName, busy = false, onAdd }: EmailBlastImportExcelFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileName, setFileName] = useState("");

  const locked = busy || importing;

  async function handleFile(file: File | null) {
    if (!file) return;

    setFileName(file.name);
    setError("");
    setSuccess("");
    setImporting(true);

    try {
      const parsed = await parseContactsFromExcelFile(file);
      await onAdd(parsed.contacts);

      const parts = [`${parsed.contacts.length} kontak ditambahkan ke "${groupName}".`];
      if (parsed.skipped > 0) parts.push(`${parsed.skipped} baris dilewati.`);
      if (parsed.invalidEmails.length > 0) {
        parts.push(`${parsed.invalidEmails.length} email tidak valid diabaikan.`);
      }
      setSuccess(parts.join(" "));
      if (inputRef.current) inputRef.current.value = "";
    } catch (cause) {
      setSuccess("");
      setError(cause instanceof Error ? cause.message : "Gagal mengimpor Excel.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={styles.icon}>
      <div className={styles.glyph}>
        <FileSpreadsheet className={styles.iconFilespreadsheet} />
        <p className={styles.errortext}>Tambah dari Excel</p>
      </div>

      <p className={styles.text}>
        Baris 1: header <span className={styles.meta}>nama</span> |{" "}
        <span className={styles.meta}>email</span> |{" "}
        <span className={styles.meta}>company</span> (opsional). Baris berikutnya berisi data kontak.
        Format: <code className={styles.code}>.xlsx</code>,{" "}
        <code className={styles.code}>.xls</code>, atau{" "}
        <code className={styles.code}>.csv</code>.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className={styles.sronly}
        disabled={locked}
        onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
      />

      {fileName ? <p className={styles.itemDescription}>File: {fileName}</p> : null}
      {error ? <p className={styles.textP}>{error}</p> : null}
      {success ? <p className={styles.textPrimary}>{success}</p> : null}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className={styles.button}
        disabled={locked}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className={styles.iconUpload} />
        {importing ? "Mengimpor…" : "+ Tambah dari Excel"}
      </Button>
    </div>
  );
}
