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

export function scheduleRouterRefresh(router: AppRouterInstance) {
  if (refreshTimer) window.clearTimeout(refreshTimer);

  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    if (Date.now() - lastNavigationAt < NAVIGATION_COOLDOWN_MS) return;
    if (refreshInFlight) return;

    refreshInFlight = true;
    router.refresh();
    window.setTimeout(() => {
      refreshInFlight = false;
    }, REFRESH_DEBOUNCE_MS);
  }, REFRESH_DEBOUNCE_MS);
}
