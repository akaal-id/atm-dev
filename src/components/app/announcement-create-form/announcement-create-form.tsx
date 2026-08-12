"use client";

import styles from "./announcement-create-form.module.css";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.label}>
      <span className={styles.caption}>{label}</span>
      {children}
    </label>
  );
}

export function AnnouncementCreateForm({ createdBy }: { createdBy: string }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);

    try {
      const response = await fetch("/api/resources/Announcements", {
        method: "POST",
        headers: { accept: "application/json" },
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to publish announcement");
      }

      const title = String(formData.get("title") || "Announcement");
      pushToast({
        tone: "success",
        title: "Announcement published",
        description: `"${title}" is now visible in the company feed.`,
      });
      form.reset();
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Could not publish",
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <input type="hidden" name="created_by" value={createdBy} />
      <Field label="Title">
        <input name="title" required className="input" />
      </Field>
      <Field label="Category">
        <FormSelect
          name="category"
          defaultValue="General"
          options={["General", "HR", "Task", "Event", "Birthday", "Important", "Policy", "Reminder"].map((category) => ({
            value: category,
            label: category,
          }))}
        />
      </Field>
      <Field label="Body">
        <textarea name="body" required className={styles.input} />
      </Field>
      <label className={styles.bodylabel}>
        <input name="is_pinned" type="checkbox" className={styles.bodyinput} /> Pin important announcement
      </label>
      <Button type="submit" variant="default" size="xl" className={styles.submit} disabled={pending}>
        {pending ? "Publishing…" : "Publish"}
      </Button>
    </form>
  );
}
