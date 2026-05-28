"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";

import { isUserEditing, markNavigation, scheduleRouterRefresh } from "@/lib/safe-router-refresh";

export function LiveRefresh({ interval = 30000 }: { interval?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const refreshingRef = useRef(false);

  useEffect(() => {
    markNavigation();
  }, [pathname]);

  useEffect(() => {
    const refreshInterval = process.env.NODE_ENV === "development" ? Math.max(interval, 120000) : interval;

    const refresh = () => {
      if (document.visibilityState !== "visible" || refreshingRef.current || isUserEditing()) return;
      refreshingRef.current = true;
      startTransition(() => {
        scheduleRouterRefresh(router);
      });
      window.setTimeout(() => {
        refreshingRef.current = false;
      }, 5000);
    };

    const timer = window.setInterval(refresh, refreshInterval);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [interval, router]);

  return null;
}
