"use client";

import styles from "./email-blast-send-button.module.css";

import { CheckCircle2, Loader2, SendHorizontal, XCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export type SendStatus = "idle" | "sending" | "success" | "error";

export type SendResult = {
  status: Extract<SendStatus, "success" | "error">;
  message: string;
};

interface EmailBlastSendButtonProps {
  recipientCount: number;
  attachmentCount: number;
  /** When false, the send button stays disabled (form validation). */
  formValid: boolean;
  disabled?: boolean;
  /** Stub send until backend/Resend is wired — returns success by default. */
  onSend?: () => Promise<void>;
  onResult?: (result: SendResult) => void;
}

export function EmailBlastSendButton({
  recipientCount,
  attachmentCount,
  formValid,
  disabled = false,
  onSend,
  onResult,
}: EmailBlastSendButtonProps) {
  const [status, setStatus] = useState<SendStatus>("idle");
  const [message, setMessage] = useState("");

  const canSend = !disabled && formValid && status !== "sending";

  function report(next: SendStatus, nextMessage: string) {
    setStatus(next);
    setMessage(nextMessage);
    if (next === "success" || next === "error") {
      onResult?.({ status: next, message: nextMessage });
    }
  }

  async function handleSend() {
    if (!formValid) {
      report("error", "Lengkapi subjek, body, dan penerima sebelum mengirim.");
      return;
    }
    if (!canSend) return;

    report(
      "sending",
      attachmentCount > 0
        ? `Mengirim ke ${recipientCount} penerima (${attachmentCount} lampiran)…`
        : `Mengirim ke ${recipientCount} penerima…`,
    );

    try {
      if (onSend) {
        await onSend();
      } else {
        // Frontend stub — real Resend call comes in a later backend task.
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      report("success", `Blast terkirim ke ${recipientCount} penerima.`);
    } catch (cause) {
      report("error", cause instanceof Error ? cause.message : "Gagal mengirim blast. Coba lagi.");
    }
  }

  return (
    <div className={styles.group}>
      <div className={styles.region}>
        <div>
          <p className={styles.errortext}>Kirim sekarang</p>
          <p className={styles.textP}>
            {formValid
              ? `Siap dikirim ke ${recipientCount} penerima${attachmentCount > 0 ? ` · ${attachmentCount} lampiran` : ""}.`
              : "Lengkapi subjek, body, dan penerima untuk mengaktifkan tombol kirim."}
          </p>
        </div>
        <Button
          type="button"
          variant={status === "success" ? "success" : "default"}
          size="xl"
          className={styles.button}
          disabled={!canSend}
          aria-disabled={!canSend}
          onClick={() => void handleSend()}
        >
          {status === "sending" ? (
            <>
              <Loader2 className={styles.spinner} />
              Mengirim…
            </>
          ) : status === "success" ? (
            <>
              <CheckCircle2 className={styles.icon} />
              Terkirim
            </>
          ) : (
            <>
              <SendHorizontal className={styles.icon} />
              Kirim sekarang
            </>
          )}
        </Button>
      </div>

      {!formValid && status !== "sending" ? (
        <p className={styles.text}>
          Tombol kirim aktif setelah subjek, body, dan minimal satu penerima terisi.
        </p>
      ) : null}

      {message && status === "sending" ? (
        <div
          className={styles.glyph}
          role="status"
        >
          <Loader2 className={styles.spinnerLoader} />
          <span>{message}</span>
        </div>
      ) : null}

      {message && (status === "success" || status === "error") ? (
        <div
          className={
            status === "error"
              ? styles.iconDiv
              : styles.iconPrimary
          }
          role="status"
        >
          {status === "error" ? <XCircle className={styles.iconXcircle} /> : <CheckCircle2 className={styles.iconXcircle} />}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}
