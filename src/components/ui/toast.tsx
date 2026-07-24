"use client";

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
      <div className="pointer-events-none fixed bottom-20 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 md:bottom-6">
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
                  ? "pointer-events-auto flex items-start gap-3 rounded-[2px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm"
                  : isError
                    ? "pointer-events-auto flex items-start gap-3 rounded-[2px] border border-red-200 bg-red-50 px-4 py-3 text-red-900 shadow-sm"
                    : "pointer-events-auto flex items-start gap-3 rounded-[2px] border border-border bg-card px-4 py-3 text-foreground shadow-sm"
              }
            >
              {isSuccess ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              ) : isError ? (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-normal">{item.title}</p>
                {item.description ? <p className="mt-0.5 text-sm opacity-90">{item.description}</p> : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-current hover:bg-black/5"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
