"use client";

import { Paperclip, X } from "lucide-react";
import { useRef } from "react";

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
}

/** File picker + list for blast attachments (uploaded to storage on send). */
export function EmailBlastAttachmentField({ attachments, onChange }: EmailBlastAttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="space-y-3 rounded-[2px] border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-normal text-foreground">Attachments</p>
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">Flyer, proposal, atau dokumen promosi (opsional).</p>
        </div>
        <Button type="button" variant="outline" size="lg" className="h-10" onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
          Add files
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => addFiles(event.target.files)}
      />

      {attachments.length === 0 ? (
        <div className="rounded-[2px] border border-dashed border-border bg-surface-inset/80 px-4 py-5 text-center text-sm font-normal text-muted-foreground">
          Belum ada lampiran. Klik &quot;Add files&quot; untuk mengunggah.
        </div>
      ) : (
        <ul className="space-y-2">
          {attachments.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-3 rounded-[2px] border border-border bg-surface-inset px-3 py-2.5"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-normal text-foreground">{item.file.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{formatFileSize(item.file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.file.name}`}
                onClick={() => removeAttachment(item.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
