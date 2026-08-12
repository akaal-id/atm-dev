"use client";

import styles from "./email-blast-settings-feedback.module.css";

import { CheckCircle2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export type SettingsFeedback = {
  tone: "success" | "error";
  message: string;
};

interface EmailBlastSettingsFeedbackProps {
  feedback: SettingsFeedback;
  onDismiss: () => void;
}

/** Page-level success/error banner after saving account settings. */
export function EmailBlastSettingsFeedback({ feedback, onDismiss }: EmailBlastSettingsFeedbackProps) {
  const isSuccess = feedback.tone === "success";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={
        isSuccess
          ? styles.alert
          : styles.emailblastsettingsfeedback
      }
    >
      {isSuccess ? (
        <CheckCircle2 className={styles.icon} aria-hidden />
      ) : (
        <XCircle className={styles.xcircle} aria-hidden />
      )}
      <div className={styles.content}>
        <p className={styles.text}>{isSuccess ? "Pengaturan tersimpan" : "Gagal menyimpan"}</p>
        <p className={styles.itemDescription}>{feedback.message}</p>
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
