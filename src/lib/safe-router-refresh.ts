"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const NAVIGATION_COOLDOWN_MS = 2500;
const REFRESH_DEBOUNCE_MS = 400;

let lastNavigationAt = 0;
let refreshTimer: number | null = null;
let refreshInFlight = false;

export function markNavigation() {
  lastNavigationAt = Date.now();
}

/** Skip background refresh while the user is typing in a field. */
export function isUserEditing(): boolean {
  if (typeof document === "undefined") return false;

  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;

  const tag = active.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;

  if (tag === "INPUT") {
    const type = (active as HTMLInputElement).type;
    if (type === "button" || type === "submit" || type === "reset" || type === "hidden") return false;
    return true;
  }

  return false;
}

export function scheduleRouterRefresh(router: AppRouterInstance) {
  if (refreshTimer) window.clearTimeout(refreshTimer);

  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    if (Date.now() - lastNavigationAt < NAVIGATION_COOLDOWN_MS) return;
    if (refreshInFlight) return;
    if (isUserEditing()) return;

    refreshInFlight = true;
    router.refresh();
    window.setTimeout(() => {
      refreshInFlight = false;
    }, REFRESH_DEBOUNCE_MS);
  }, REFRESH_DEBOUNCE_MS);
}
