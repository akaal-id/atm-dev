"use client";

import styles from "./social-persona-modal.module.css";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { requestJson } from "@/lib/request-json";
import { personaFields, type AudiencePersona } from "@/lib/types/social-hub";

type Draft = Record<(typeof personaFields)[number], string>;

const shortFields: Array<{ field: keyof Draft; label: string; placeholder: string }> = [
  { field: "age_range", label: "Age", placeholder: "18–24" },
  { field: "gender", label: "Gender", placeholder: "Female" },
  { field: "location", label: "Location", placeholder: "Jakarta" },
  { field: "occupation", label: "Occupation", placeholder: "University student" },
];

const longFields: Array<{ field: keyof Draft; label: string; placeholder: string }> = [
  { field: "description", label: "Description", placeholder: "Who they are and how they discover brands" },
  { field: "interests", label: "Interests", placeholder: "Comma separated: skincare, K-drama, thrifting" },
  { field: "pain_points", label: "Pain points", placeholder: "What frustrates them" },
  { field: "goals", label: "Goals", placeholder: "What they want to achieve" },
  { field: "channels", label: "Channels", placeholder: "Comma separated: Instagram, TikTok" },
];

/** Add or edit an audience persona. Mount only while open; `persona = null` creates. */
export function SocialPersonaModal({
  projectId,
  persona,
  nextSortOrder,
  onClose,
}: {
  projectId: string;
  persona: AudiencePersona | null;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(personaFields.map((field) => [field, persona?.[field] ?? ""])) as Draft);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      pushToast({ tone: "success", title: success });
      onClose();
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not save persona", description: error instanceof Error ? error.message : "Something went wrong." });
      setBusy(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || busy) return;
    void run(
      () =>
        persona
          ? requestJson(`/api/projects/${projectId}/personas/${persona.persona_id}`, "PATCH", draft)
          : requestJson(`/api/projects/${projectId}/personas`, "POST", { ...draft, sort_order: nextSortOrder }),
      persona ? "Persona updated" : "Persona added",
    );
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={persona ? "Edit persona" : "Add persona"} eyebrow="Audience persona" className={styles.panel}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Persona name</span>
          <input className="input" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Nadia, the conscious student" />
        </label>
        <div className={styles.grid}>
          {shortFields.map(({ field, label, placeholder }) => (
            <label key={field} className={styles.field}>
              <span className={styles.label}>{label}</span>
              <input className="input" value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} placeholder={placeholder} />
            </label>
          ))}
        </div>
        {longFields.map(({ field, label, placeholder }) => (
          <label key={field} className={styles.field}>
            <span className={styles.label}>{label}</span>
            <textarea className="input" rows={2} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} placeholder={placeholder} />
          </label>
        ))}
        <div className={styles.actions}>
          {persona ? (
            <Button
              type="button"
              variant="destructiveOutline"
              disabled={busy}
              onClick={() => void run(() => requestJson(`/api/projects/${projectId}/personas/${persona.persona_id}`, "DELETE"), "Persona deleted")}
            >
              <Trash2 className={styles.icon} aria-hidden />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={busy || !draft.name.trim()}>
            {busy ? <Loader2 className={styles.spinner} aria-hidden /> : null}
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
