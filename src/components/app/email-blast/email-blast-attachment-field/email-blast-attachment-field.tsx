"use client";

import styles from "./email-blast-attachment-field.module.css";

import { Paperclip, X } from "lucide-react";
import { useRef } from "react";

import { MAX_ATTACHMENT_TOTAL_BYTES } from "@/components/app/email-blast/email-blast-form-validation";
import { Button } from "@/components/ui/button";

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type EmailBlastAttachment = {
  id: string;
  file: File;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface EmailBlastAttachmentFieldProps {
  attachments: EmailBlastAttachment[];
  onChange: (attachments: EmailBlastAttachment[]) => void;
  error?: string;
}

/** File picker + list for blast attachments (sent as real email attachments, not links). */
export function EmailBlastAttachmentField({ attachments, onChange, error }: EmailBlastAttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalBytes = attachments.reduce((sum, item) => sum + item.file.size, 0);
  const overLimit = totalBytes > MAX_ATTACHMENT_TOTAL_BYTES;

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next = [...attachments];
    for (const file of Array.from(fileList)) {
      const duplicate = next.some((item) => item.file.name === file.name && item.file.size === file.size);
      if (duplicate) continue;
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`, file });
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAttachment(id: string) {
    onChange(attachments.filter((item) => item.id !== id));
  }

  return (
    <div className={styles.filterBar}>
      <div className={styles.listBody}>
        <div>
          <p className={styles.text}>Attachments</p>
          <p className={styles.textP}>Flyer, proposal, atau dokumen promosi (opsional).</p>
        </div>
        <div className={styles.filterbarPrimary}>
          {attachments.length > 0 ? (
            <span className={`text-xs font-normal ${overLimit ? styles.meta : styles.caption}`}>
              Total: {formatFileSize(totalBytes)} / {formatFileSize(MAX_ATTACHMENT_TOTAL_BYTES)}
            </span>
          ) : null}
          <Button type="button" variant="outline" size="lg" className={styles.button} onClick={() => inputRef.current?.click()}>
            <Paperclip className={styles.block} />
            Add files
          </Button>
        </div>
      </div>

      {error ? <p className={styles.errortext}>{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className={styles.sronly}
        onChange={(event) => addFiles(event.target.files)}
      />

      {attachments.length === 0 ? (
        <div className={styles.emptystate}>
          Belum ada lampiran. Klik &quot;Add files&quot; untuk mengunggah.
        </div>
      ) : (
        <ul className={styles.list}>
          {attachments.map((item) => (
            <li
              key={item.id}
              className={styles.item}
            >
              <Paperclip className={styles.surface} />
              <div className={styles.content}>
                <p className={styles.itemDescription}>{item.file.name}</p>
                <p className={styles.textPrimary}>{formatFileSize(item.file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.file.name}`}
                onClick={() => removeAttachment(item.id)}
              >
                <X className={styles.block} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
