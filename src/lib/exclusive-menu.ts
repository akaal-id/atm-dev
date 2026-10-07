"use client";

import { useEffect } from "react";

const EVENT = "atm:exclusive-menu-open";

/**
 * Only one top-bar dropdown open at a time: when this menu opens it announces itself,
 * and any other menu using the hook closes.
 */
export function useExclusiveMenu(id: string, open: boolean, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (open) window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: id }));
  }, [id, open]);

  useEffect(() => {
    const onOtherOpened = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    };
    window.addEventListener(EVENT, onOtherOpened);
    return () => window.removeEventListener(EVENT, onOtherOpened);
  }, [id, setOpen]);
}
