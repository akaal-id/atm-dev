"use client";

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
    <div className="space-y-3 rounded-[2px] border border-border bg-surface-inset/80 p-3">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-normal text-foreground">Tambah dari Excel</p>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Baris 1: header <span className="font-normal text-foreground">nama</span> |{" "}
        <span className="font-normal text-foreground">email</span>. Baris berikutnya berisi data kontak.
        Format: <code className="rounded bg-card px-1 py-0.5">.xlsx</code>,{" "}
        <code className="rounded bg-card px-1 py-0.5">.xls</code>, atau{" "}
        <code className="rounded bg-card px-1 py-0.5">.csv</code>.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="sr-only"
        disabled={locked}
        onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
      />

      {fileName ? <p className="truncate text-xs font-normal text-muted-foreground">File: {fileName}</p> : null}
      {error ? <p className="text-xs font-normal text-red-600">{error}</p> : null}
      {success ? <p className="text-xs font-normal text-emerald-700">{success}</p> : null}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-10 w-full"
        disabled={locked}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {importing ? "Mengimpor…" : "+ Tambah dari Excel"}
      </Button>
    </div>
  );
}
