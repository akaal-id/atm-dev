"use client";

import styles from "./task-confirm-modal.module.css";

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
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.heading}>{title}</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            aria-label="Close confirmation"
          >
            <X className={styles.closeIcon} />
          </Button>
        </div>

        <div className={styles.body}>
          <p className={styles.itemDescription}>{description}</p>

          <div className={styles.actions}>
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
