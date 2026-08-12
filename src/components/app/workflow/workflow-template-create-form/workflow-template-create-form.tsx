"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTenant } from "@/components/app/tenant-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import styles from "./workflow-template-create-form.module.css";

export function WorkflowTemplateCreateForm() {
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    // Frontend stub — persist via API in a later backend task.
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    pushToast({
      tone: "success",
      title: "Template drafted",
      description: `"${trimmed}" saved as mock data. Column setup comes next.`,
    });
    router.push(tenant.href("/admin/workflows"));
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <p className={styles.notice}>
        Formulir ini masih stub frontend. Setelah disimpan kamu kembali ke daftar template; pengaturan kolom
        menyusul di halaman detail.
      </p>

      <label className={styles.field}>
        <span className={styles.label}>Template name</span>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Creative Sprint"
          required
          autoFocus
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Description</span>
        <textarea
          className="input"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="When should teams use this board?"
        />
        <span className={styles.hint}>Opsional — membantu admin memilih template saat buat proyek.</span>
      </label>

      <label className={styles.checkRow}>
        <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
        <span className={styles.checkCopy}>
          <span className={styles.checkTitle}>Set as company default</span>
          <span className={styles.checkHint}>Proyek baru tanpa pilihan template akan memakai yang ini.</span>
        </span>
      </label>

      <div className={styles.actions}>
        <Link
          href={tenant.href("/admin/workflows")}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 font-normal")}
        >
          Cancel
        </Link>
        <Button type="submit" size="lg" className="h-10 font-normal" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Create template"}
        </Button>
      </div>
    </form>
  );
}
