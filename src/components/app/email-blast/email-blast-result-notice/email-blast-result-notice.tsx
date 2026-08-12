"use client";

import styles from "./email-blast-result-notice.module.css";

import { CheckCircle2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SendStatus } from "@/components/app/email-blast/email-blast-send-button";

interface EmailBlastResultNoticeProps {
  status: Extract<SendStatus, "success" | "error">;
  message: string;
  onDismiss: () => void;
}

/** Page-level success/error banner after a blast send attempt. */
export function EmailBlastResultNotice({ status, message, onDismiss }: EmailBlastResultNoticeProps) {
  const isSuccess = status === "success";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={
        isSuccess
          ? styles.alert
          : styles.emailblastresultnotice
      }
    >
      {isSuccess ? (
        <CheckCircle2 className={styles.icon} aria-hidden />
      ) : (
        <XCircle className={styles.xcircle} aria-hidden />
      )}
      <div className={styles.content}>
        <p className={styles.text}>
          {isSuccess ? "Pengiriman berhasil" : "Pengiriman gagal"}
        </p>
        <p className={styles.itemDescription}>{message}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={styles.button}
        aria-label="Tutup notifikasi"
        onClick={onDismiss}
      >
        <X className={styles.tutupNotifikasi} />
      </Button>
    </div>
  );
}
