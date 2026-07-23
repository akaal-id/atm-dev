"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

function SectionTitle({ title }: { title: string }) {
  return <h2 className="min-w-0 truncate text-base font-normal tracking-normal text-foreground">{title}</h2>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-normal text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

interface EmailBlastCreateGroupFormProps {
  onCreate?: (groupName: string) => void;
}

/** Form to create a new contact group. */
export function EmailBlastCreateGroupForm({ onCreate }: EmailBlastCreateGroupFormProps) {
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name) {
      setError("Nama grup wajib diisi.");
      setSuccess("");
      return;
    }
    onCreate?.(name);
    setGroupName("");
    setError("");
    setSuccess(`Grup "${name}" ditambahkan.`);
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Buat grup baru" />
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nama grup">
            <input
              name="group_name"
              type="text"
              value={groupName}
              onChange={(event) => {
                setGroupName(event.target.value);
                if (error) setError("");
                if (success) setSuccess("");
              }}
              className="input"
              placeholder="Contoh: Prospek B2B"
              autoComplete="off"
              required
            />
          </Field>
          {error ? <p className="text-sm font-normal text-red-600">{error}</p> : null}
          {success ? <p className="text-sm font-normal text-emerald-700">{success}</p> : null}
          <Button type="submit" variant="default" size="xl" className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Buat grup
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
