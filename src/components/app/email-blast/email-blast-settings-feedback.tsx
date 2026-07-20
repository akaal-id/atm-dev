"use client";

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
          ? "flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800"
          : "flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800"
      }
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-normal">{isSuccess ? "Pengaturan tersimpan" : "Gagal menyimpan"}</p>
        <p className="mt-0.5 text-sm font-medium opacity-90">{feedback.message}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-current hover:bg-black/5"
        aria-label="Tutup notifikasi"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
