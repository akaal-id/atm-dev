"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";

export function TaskConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  confirming = false,
  tone = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirming?: boolean;
  tone?: "default" | "danger";
}) {
  if (!open) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[60] grid place-items-end bg-neutral-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
      <div className="w-full rounded-t-[2px] bg-card shadow-2xl sm:max-w-md sm:rounded-[2px]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-normal tracking-normal text-foreground">{title}</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 p-5">
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="xl" onClick={() => onOpenChange(false)} disabled={confirming}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={tone === "danger" ? "destructiveSolid" : "default"}
              size="xl"
              onClick={onConfirm}
              disabled={confirming}
            >
              {confirming ? "Please wait..." : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
