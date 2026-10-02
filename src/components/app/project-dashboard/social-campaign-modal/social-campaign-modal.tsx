"use client";

import styles from "./social-campaign-modal.module.css";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { requestJson } from "@/lib/request-json";
import type { Campaign } from "@/lib/types/social-hub";

type Draft = { name: string; objective: string; channel: string; start_date: string; end_date: string; budget: string; brief_url: string; notes: string };

/** Add or edit a campaign. Mount only while open; `campaign = null` creates. */
export function SocialCampaignModal({
  projectId,
  campaign,
  channels,
  onClose,
}: {
  projectId: string;
  campaign: Campaign | null;
  /** Channel labels from the project strategy. */
  channels: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => ({
    name: campaign?.name ?? "",
    objective: campaign?.objective ?? "",
    channel: campaign?.channel ?? "",
    start_date: campaign?.start_date ?? "",
    end_date: campaign?.end_date ?? "",
    budget: campaign?.budget === null || campaign?.budget === undefined ? "" : String(campaign.budget),
    brief_url: campaign?.brief_url ?? "",
    notes: campaign?.notes ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const channelOptions = [...new Set([...channels, ...(draft.channel ? [draft.channel] : [])])];

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      pushToast({ tone: "success", title: success });
      onClose();
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not save campaign", description: error instanceof Error ? error.message : "Something went wrong." });
      setBusy(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || busy) return;
    if (draft.start_date && draft.end_date && draft.end_date < draft.start_date) {
      pushToast({ tone: "error", title: "End date must be on or after start date" });
      return;
    }
    const body = { ...draft, budget: draft.budget === "" ? null : draft.budget };
    void run(
      () =>
        campaign
          ? requestJson(`/api/projects/${projectId}/campaigns/${campaign.campaign_id}`, "PATCH", body)
          : requestJson(`/api/projects/${projectId}/campaigns`, "POST", body),
      campaign ? "Campaign updated" : "Campaign added",
    );
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={campaign ? "Edit campaign" : "Add campaign"} eyebrow="Campaign" className={styles.panel}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Campaign name</span>
          <input className="input" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Ramadan Giveaway 2026" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Objective</span>
          <textarea className="input" rows={2} value={draft.objective} onChange={(event) => setDraft({ ...draft, objective: event.target.value })} />
        </label>
        <div className={styles.grid}>
          <div className={styles.field}>
            <span className={styles.label}>Start date</span>
            <DatePickerField variant="form" value={draft.start_date} onChange={(value) => setDraft({ ...draft, start_date: value })} clearable />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>End date</span>
            <DatePickerField variant="form" value={draft.end_date} onChange={(value) => setDraft({ ...draft, end_date: value })} clearable />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Channel</span>
            <FormSelect
              name="channel"
              value={draft.channel}
              onValueChange={(channel) => setDraft({ ...draft, channel })}
              placeholder="—"
              options={[{ value: "", label: "—" }, ...channelOptions.map((channel) => ({ value: channel, label: channel }))]}
            />
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Budget (IDR)</span>
            <input className="input" type="number" min="0" step="1000" value={draft.budget} onChange={(event) => setDraft({ ...draft, budget: event.target.value })} />
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Brief link</span>
          <input className="input" type="url" value={draft.brief_url} onChange={(event) => setDraft({ ...draft, brief_url: event.target.value })} placeholder="https://" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Notes</span>
          <textarea className="input" rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </label>
        <div className={styles.actions}>
          {campaign ? (
            <Button
              type="button"
              variant="destructiveOutline"
              disabled={busy}
              onClick={() => void run(() => requestJson(`/api/projects/${projectId}/campaigns/${campaign.campaign_id}`, "DELETE"), "Campaign deleted")}
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
