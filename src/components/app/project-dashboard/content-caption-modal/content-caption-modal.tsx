"use client";

import styles from "./content-caption-modal.module.css";

import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";
import { requestJson } from "@/lib/request-json";
import type { ContentItem } from "@/lib/types/project-hub";

type LinkField = "drive_url" | "publication_url";

/** Caption + delivery links for one content row. Mount only while open. */
export function ContentCaptionModal({
  projectId,
  item,
  canEdit,
  onClose,
}: {
  projectId: string;
  item: ContentItem;
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [draft, setDraft] = useState({ caption: item.caption, drive_url: item.drive_url, publication_url: item.publication_url });
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = draft.caption !== item.caption || draft.drive_url !== item.drive_url || draft.publication_url !== item.publication_url;

  async function copy(key: string, text: string) {
    try {
      await copyText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
    } catch (error) {
      pushToast({ tone: "error", title: "Could not copy", description: error instanceof Error ? error.message : undefined });
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await requestJson(`/api/projects/${projectId}/content/${item.item_id}`, "PATCH", draft);
      pushToast({ tone: "success", title: "Caption & links saved" });
      onClose();
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not save", description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  const links: Array<{ field: LinkField; label: string }> = [
    { field: "drive_url", label: "Drive link" },
    { field: "publication_url", label: "Publication link" },
  ];

  return (
    <Modal open onClose={() => !saving && onClose()} title={item.title} eyebrow={item.task_id ? `Caption · ${item.task_id}` : "Caption"} className={styles.panel}>
      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h3 className={styles.label}>Caption</h3>
            <span className={styles.count}>{draft.caption.length} characters</span>
            <Button type="button" size="sm" onClick={() => void copy("caption", draft.caption)} disabled={!draft.caption}>
              {copied === "caption" ? <Check className={styles.icon} aria-hidden /> : <Copy className={styles.icon} aria-hidden />}
              {copied === "caption" ? "Copied" : "Copy caption"}
            </Button>
          </div>
          {canEdit ? (
            <textarea
              className={`input ${styles.caption}`}
              value={draft.caption}
              onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
              placeholder="Write or paste the caption, hashtags included…"
              rows={10}
            />
          ) : (
            <pre className={styles.captionView}>{item.caption || "No caption yet."}</pre>
          )}
        </section>

        {links.map(({ field, label }) => (
          <section key={field} className={styles.section}>
            <h3 className={styles.label}>{label}</h3>
            <div className={styles.linkRow}>
              {canEdit ? (
                <input
                  className="input"
                  type="url"
                  value={draft[field]}
                  onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                  placeholder="https://"
                />
              ) : (
                <span className={styles.linkText}>{item[field] || "—"}</span>
              )}
              <Button type="button" variant="outline" size="icon" onClick={() => void copy(field, draft[field])} disabled={!draft[field]} aria-label={`Copy ${label}`}>
                {copied === field ? <Check className={styles.icon} /> : <Copy className={styles.icon} />}
              </Button>
              {draft[field] ? (
                <a className={styles.open} href={draft[field]} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}>
                  <ExternalLink className={styles.icon} />
                </a>
              ) : null}
            </div>
          </section>
        ))}

        {canEdit ? (
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Close
            </Button>
            <Button type="button" onClick={() => void save()} disabled={!dirty || saving}>
              {saving ? <Loader2 className={styles.spinner} aria-hidden /> : null}
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
