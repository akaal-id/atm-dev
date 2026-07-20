"use client";

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
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Kirim sekarang</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {formValid
              ? `Siap dikirim ke ${recipientCount} penerima${attachmentCount > 0 ? ` · ${attachmentCount} lampiran` : ""}.`
              : "Lengkapi subjek, body, dan penerima untuk mengaktifkan tombol kirim."}
          </p>
        </div>
        <Button
          type="button"
          variant={status === "success" ? "success" : "default"}
          size="xl"
          className="min-w-44"
          disabled={!canSend}
          aria-disabled={!canSend}
          onClick={() => void handleSend()}
        >
          {status === "sending" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Mengirim…
            </>
          ) : status === "success" ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Terkirim
            </>
          ) : (
            <>
              <SendHorizontal className="h-4 w-4" />
              Kirim sekarang
            </>
          )}
        </Button>
      </div>

      {!formValid && status !== "sending" ? (
        <p className="text-xs font-medium text-amber-700">
          Tombol kirim aktif setelah subjek, body, dan minimal satu penerima terisi.
        </p>
      ) : null}

      {message && status === "sending" ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600"
          role="status"
        >
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          <span>{message}</span>
        </div>
      ) : null}

      {message && (status === "success" || status === "error") ? (
        <div
          className={
            status === "error"
              ? "flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
              : "flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700"
          }
          role="status"
        >
          {status === "error" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}
