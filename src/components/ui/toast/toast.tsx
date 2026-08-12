"use client";

import styles from "./toast.module.css";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

export type ToastTone = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastContextValue = {
  pushToast: (toast: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setItems((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.noPointer}>
        {items.map((item) => {
          const tone = item.tone ?? "info";
          const isSuccess = tone === "success";
          const isError = tone === "error";
          return (
            <div
              key={item.id}
              role="status"
              aria-live="polite"
              className={
                isSuccess
                  ? styles.autoPointer
                  : isError
                    ? styles.autoPointerAlt
                    : styles.pointereventsautoPrimary
              }
            >
              {isSuccess ? (
                <CheckCircle2 className={styles.icon} aria-hidden />
              ) : isError ? (
                <XCircle className={styles.xcircle} aria-hidden />
              ) : null}
              <div className={styles.content}>
                <p className={styles.itemDescription}>{item.title}</p>
                {item.description ? <p className={styles.errortext}>{item.description}</p> : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={styles.button}
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
              >
                <X className={styles.dismissNotification} />
              </Button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
