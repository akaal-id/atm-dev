"use client";

import styles from "./modal.module.css";

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
      <div className={styles.modalpanel}>
        <div
          className={cn(
            styles.dialogPanel,
            widthClassName,
          )}
        >
          <div className={styles.dialogpanelDiv}>
            <div className={styles.content}>
              {eyebrow ? <p className={styles.itemDescription}>{eyebrow}</p> : null}
              <h2 className={styles.heading}>{title}</h2>
            </div>
            <Button type="button" variant="outline" size="icon-sm" onClick={onClose} aria-label={`Close ${title}`}>
              <X className={styles.icon} />
            </Button>
          </div>
          <div className={styles.dialogpanelPrimary}>{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}
