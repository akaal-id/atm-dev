"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

function subscribe() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function ModalPortal({ children }: { children: React.ReactNode }) {
  const mounted = useIsClient();

  if (!mounted) {
    return null;
  }

  return createPortal(children, document.body);
}
