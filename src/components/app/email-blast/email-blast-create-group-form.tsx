"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface EmailBlastCreateGroupFormProps {
  busy?: boolean;
  onCreate: (groupName: string) => Promise<void> | void;
}

/** Form to create a new contact group (meant to live inside a modal). */
export function EmailBlastCreateGroupForm({ busy = false, onCreate }: EmailBlastCreateGroupFormProps) {
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name) {
      setError("Nama grup wajib diisi.");
      return;
    }
    try {
      await onCreate(name);
      setGroupName("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat grup.");
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <label className="grid gap-2 text-sm font-normal text-foreground">
        Nama grup
        <input
          name="group_name"
          type="text"
          value={groupName}
          onChange={(event) => {
            setGroupName(event.target.value);
            if (error) setError("");
          }}
          className="input"
          placeholder="Contoh: Prospek B2B"
          autoComplete="off"
          disabled={busy}
          required
        />
      </label>
      {error ? <p className="text-sm font-normal text-red-600">{error}</p> : null}
      <Button type="submit" variant="default" size="xl" className="w-full" disabled={busy}>
        <Plus className="h-4 w-4" />
        {busy ? "Menyimpan…" : "Buat grup"}
      </Button>
    </form>
  );
}
