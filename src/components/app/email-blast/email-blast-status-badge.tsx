import { Badge } from "@/components/ui/badge";
import type { BlastRecipientStatus } from "@/lib/data/email-blast-mock";

type BlastStatusTone = "neutral" | "blue" | "green" | "yellow" | "red" | "purple";

const OVERALL_STATUS_TONE: Record<string, BlastStatusTone> = {
  Sent: "green",
  Partial: "yellow",
  Pending: "blue",
  Failed: "red",
  Skipped: "neutral",
};

const RECIPIENT_STATUS_TONE: Record<BlastRecipientStatus, BlastStatusTone> = {
  delivered: "green",
  opened: "green",
  clicked: "green",
  sent: "blue",
  queued: "blue",
  scheduled: "blue",
  pending: "yellow",
  delivery_delayed: "yellow",
  bounced: "red",
  failed: "red",
  complained: "red",
  canceled: "neutral",
  suppressed: "red",
  skipped: "neutral",
};

const RECIPIENT_STATUS_LABEL: Record<BlastRecipientStatus, string> = {
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  sent: "Sent",
  queued: "Queued",
  scheduled: "Scheduled",
  pending: "Pending",
  delivery_delayed: "Delayed",
  bounced: "Bounced",
  failed: "Failed",
  complained: "Spam",
  canceled: "Canceled",
  suppressed: "Suppressed",
  skipped: "Skipped",
};

export function blastOverallStatusTone(status: string): BlastStatusTone {
  return OVERALL_STATUS_TONE[status] ?? "neutral";
}

export function blastRecipientStatusTone(status: BlastRecipientStatus): BlastStatusTone {
  return RECIPIENT_STATUS_TONE[status] ?? "neutral";
}

/** Colored pill for overall blast delivery status (Sent / Partial / Pending / Failed). */
export function EmailBlastStatusBadge({ status }: { status: string }) {
  return <Badge tone={blastOverallStatusTone(status)}>{status}</Badge>;
}

/** Colored pill for per-recipient delivery status. */
export function EmailBlastRecipientStatusBadge({ status }: { status: BlastRecipientStatus }) {
  return <Badge tone={blastRecipientStatusTone(status)}>{RECIPIENT_STATUS_LABEL[status] ?? status}</Badge>;
}
