"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  widthClassName?: string;
  children: React.ReactNode;
}

/** Generic modal frame (portal + overlay + sticky header with close button). */
export function Modal({ open, onClose, title, eyebrow, widthClassName = "sm:max-w-lg", children }: ModalProps) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-end bg-neutral-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
        <div
          className={cn(
            "max-h-[92dvh] w-full overflow-y-auto rounded-t-[2px] bg-card shadow-2xl sm:rounded-[2px]",
            widthClassName,
          )}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
            <div className="min-w-0">
              {eyebrow ? <p className="text-xs font-normal uppercase tracking-wide text-primary">{eyebrow}</p> : null}
              <h2 className="truncate text-lg font-normal tracking-normal text-foreground">{title}</h2>
            </div>
            <Button type="button" variant="outline" size="icon-sm" onClick={onClose} aria-label={`Close ${title}`}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}
