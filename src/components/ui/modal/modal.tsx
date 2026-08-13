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
  className?: string;
  children: React.ReactNode;
}

/** Generic modal frame (portal + overlay + sticky header with close button). */
export function Modal({ open, onClose, title, eyebrow, className, children }: ModalProps) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div className={styles.overlay}>
        <div className={cn(styles.panel, className)}>
          <div className={styles.header}>
            <div className={styles.content}>
              {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
              <h2 className={styles.heading}>{title}</h2>
            </div>
            <Button type="button" variant="outline" size="icon-sm" onClick={onClose} aria-label={`Close ${title}`}>
              <X className={styles.icon} />
            </Button>
          </div>
          <div className={styles.body}>{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}
