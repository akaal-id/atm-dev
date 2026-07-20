"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

function SectionTitle({ title }: { title: string }) {
  return <h2 className="min-w-0 truncate text-base font-semibold tracking-normal text-slate-950">{title}</h2>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

interface EmailBlastSenderNameFormProps {
  defaultName: string;
  onSave?: (name: string) => void;
  onFeedback?: (tone: "success" | "error", message: string) => void;
}

/** Sender display-name form persisted via /api/email-blast/sender. */
export function EmailBlastSenderNameForm({ defaultName, onSave, onFeedback }: EmailBlastSenderNameFormProps) {
  const [name, setName] = useState(defaultName);
  const [saved, setSaved] = useState(defaultName);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!next) {
      onFeedback?.("error", "Nama pengirim wajib diisi.");
      return;
    }
    void (async () => {
      const response = await fetch("/api/email-blast/sender", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sender_name: next }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onFeedback?.("error", payload?.error || "Gagal menyimpan nama pengirim.");
        return;
      }
      setSaved(next);
      onSave?.(next);
      onFeedback?.("success", `Nama pengirim diperbarui menjadi "${next}".`);
    })();
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Nama pengirim" />
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Display name">
            <input
              name="sender_name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input"
              placeholder="Akaal Marketing"
              autoComplete="name"
              required
            />
          </Field>
          <p className="text-xs font-medium text-slate-500">
            Saat ini tersimpan: <span className="font-semibold text-slate-700">{saved}</span>
          </p>
          <Button type="submit" variant="default" size="lg" className="h-10">
            Simpan nama
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
