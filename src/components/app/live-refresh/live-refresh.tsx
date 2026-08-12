"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { isUserEditing, markNavigation } from "@/lib/safe-router-refresh";
import type { AppNotification } from "@/lib/types";

export const NOTIFICATIONS_POLL_EVENT = "atm:notifications-poll";

export type NotificationsPollDetail = {
  unread: AppNotification[];
};

/** Prevent stacked intervals when the shell remounts during refresh/HMR. */
let liveRefreshTimer: number | null = null;
let liveRefreshOwners = 0;

/**
 * Lightweight poll for unread notifications only.
 * Avoids full RSC `router.refresh()` which re-fetched every workspace table every 30s.
 */
export function LiveRefresh({ interval = 30000 }: { interval?: number }) {
  const pathname = usePathname();
  const pollingRef = useRef(false);

  useEffect(() => {
    markNavigation();
  }, [pathname]);

  useEffect(() => {
    const refreshInterval = process.env.NODE_ENV === "development" ? Math.max(interval, 120000) : interval;
    liveRefreshOwners += 1;

    const poll = async () => {
      if (document.visibilityState !== "visible" || pollingRef.current || isUserEditing()) return;
      pollingRef.current = true;
      try {
        const response = await fetch("/api/notifications/unread", { cache: "no-store" }).catch(() => null);
        if (!response?.ok) return;
        const payload = (await response.json()) as { data?: AppNotification[] };
        window.dispatchEvent(
          new CustomEvent<NotificationsPollDetail>(NOTIFICATIONS_POLL_EVENT, {
            detail: { unread: payload.data ?? [] },
          }),
        );
      } finally {
        window.setTimeout(() => {
          pollingRef.current = false;
        }, 2000);
      }
    };

    if (liveRefreshTimer == null) {
      liveRefreshTimer = window.setInterval(() => void poll(), refreshInterval);
    }

    return () => {
      liveRefreshOwners -= 1;
      if (liveRefreshOwners <= 0) {
        liveRefreshOwners = 0;
        if (liveRefreshTimer != null) {
          window.clearInterval(liveRefreshTimer);
          liveRefreshTimer = null;
        }
      }
    };
  }, [interval]);

  return null;
}
