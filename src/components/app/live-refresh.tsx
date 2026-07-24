"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";

import { isUserEditing, markNavigation, scheduleRouterRefresh } from "@/lib/safe-router-refresh";

/** Prevent stacked intervals when the shell remounts during refresh/HMR. */
let liveRefreshTimer: number | null = null;
let liveRefreshOwners = 0;

export function LiveRefresh({ interval = 30000 }: { interval?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const routerRef = useRef(router);
  const refreshingRef = useRef(false);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    markNavigation();
  }, [pathname]);

  useEffect(() => {
    const refreshInterval = process.env.NODE_ENV === "development" ? Math.max(interval, 120000) : interval;
    liveRefreshOwners += 1;

    const refresh = () => {
      if (document.visibilityState !== "visible" || refreshingRef.current || isUserEditing()) return;
      refreshingRef.current = true;
      startTransition(() => {
        scheduleRouterRefresh(routerRef.current);
      });
      window.setTimeout(() => {
        refreshingRef.current = false;
      }, 5000);
    };

    if (liveRefreshTimer == null) {
      liveRefreshTimer = window.setInterval(refresh, refreshInterval);
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
