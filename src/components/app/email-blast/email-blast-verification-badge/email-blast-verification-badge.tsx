import { Badge } from "@/components/ui/badge";
import type { ContactVerificationStatus } from "@/lib/data/email-blast-contacts-mock";
import styles from "./email-blast-verification-badge.module.css";

const LABEL: Record<ContactVerificationStatus, string> = {
  unchecked: "Belum dicek",
  valid: "Verified",
  invalid: "Email tidak valid",
  unknown: "Gagal dicek",
};

const TONE: Record<ContactVerificationStatus, "neutral" | "green" | "red" | "yellow"> = {
  unchecked: "neutral",
  valid: "green",
  invalid: "red",
  unknown: "yellow",
};

/** Chip for contact email verification status (MX/format check, not Resend send). */
export function EmailBlastVerificationBadge({
  status = "unchecked",
  detail,
}: {
  status?: ContactVerificationStatus;
  detail?: string;
}) {
  return (
    <span title={detail || LABEL[status]}>
      <Badge tone={TONE[status]} className={styles.badge}>
        {LABEL[status]}
      </Badge>
    </span>
  );
}
