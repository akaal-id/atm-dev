"use client";

import styles from "./leave-request-modal.module.css";

import { Loader2, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { OFFSITE_PERMIT_LEAD_HOURS } from "@/lib/attendance-location";
import type { LeaveRequestType } from "@/lib/types";

const types: Array<{ value: LeaveRequestType; hint: string }> = [
  { value: "Izin", hint: "Personal permission" },
  { value: "Sick", hint: "Attach a doctor's note if you have one" },
  { value: "Cuti", hint: "Annual leave" },
  { value: "WFH", hint: "Work from your home base" },
  { value: "Half Day", hint: "Leave for part of the day" },
  { value: "Off-site", hint: `Working outside office/home. Submit ≥ ${OFFSITE_PERMIT_LEAD_HOURS} h before clock-in and get it approved, or a point penalty applies.` },
];

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** "Request leave" button + modal form. Opens on load with `?request=1`. */
export function LeaveRequestButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(searchParams.get("request") === "1");
  const [type, setType] = useState<LeaveRequestType>("Izin");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/resources/Leave_Requests", {
        method: "POST",
        headers: { accept: "application/json" },
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not submit the request.");
      }
      pushToast({ tone: "success", title: `${type} request submitted`, description: "Your superior will review it." });
      setOpen(false);
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Request failed", description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className={styles.icon} aria-hidden />
        Request leave
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Request leave" eyebrow="Attendance" className={styles.panel}>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <span className={styles.label}>Type</span>
            <FormSelect name="request_type" value={type} onValueChange={(value) => setType(value as LeaveRequestType)} options={types.map((option) => ({ value: option.value, label: option.value }))} />
            <p className={type === "Off-site" ? styles.warn : styles.hint}>{types.find((option) => option.value === type)?.hint}</p>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <span className={styles.label}>Start</span>
              <DatePickerField name="start_date" required variant="form" />
            </div>
            <div className={styles.field}>
              <span className={styles.label}>End</span>
              <DatePickerField name="end_date" required variant="form" />
            </div>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Reason</span>
            <textarea name="reason" required className="input" rows={3} />
          </label>
          <div className={styles.field}>
            <span className={styles.label}>Attachment (optional)</span>
            <input name="attachment_url" type="url" className="input" placeholder="https://" />
            <input name="attachment_file" type="file" accept={ACCEPT} className="input" />
          </div>
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className={styles.spin} aria-hidden /> : null}
              Submit request
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
