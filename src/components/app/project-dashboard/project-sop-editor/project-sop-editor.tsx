"use client";

import styles from "./project-sop-editor.module.css";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { RichTextEditor } from "@/components/app/rich-text-editor";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { requestJson } from "@/lib/request-json";

/** Project SOP as rich text; read-only for viewers. Stored as HTML in `projects.sop_content`. */
export function ProjectSopEditor({ projectId, content, canEdit }: { projectId: string; content: string; canEdit: boolean }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const html = useRef(content);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await requestJson(`/api/projects/${projectId}`, "PATCH", { sop_content: html.current });
      setDirty(false);
      pushToast({ tone: "success", title: "SOP saved" });
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not save SOP", description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit && !content) {
    return <p className={styles.empty}>No SOP written for this project yet.</p>;
  }

  return (
    <RichTextEditor
      content={content}
      editable={canEdit}
      placeholder="Write the SOP: workflow steps, approval rules, naming conventions, posting checklist…"
      onChange={(next) => {
        html.current = next;
        setDirty(true);
      }}
      toolbarEnd={
        <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? <Loader2 className={styles.spinner} aria-hidden /> : <Save className={styles.icon} aria-hidden />}
          {dirty ? "Save SOP" : "Saved"}
        </Button>
      }
    />
  );
}
