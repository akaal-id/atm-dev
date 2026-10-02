"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { markNavigation } from "@/lib/safe-router-refresh";
import styles from "./route-progress.module.css";

function isSameOriginNavigation(target: EventTarget | null) {
  const anchor = target instanceof Element ? target.closest("a") : null;
  if (!anchor) return false;

  const href = anchor.getAttribute("href");
  const targetAttr = anchor.getAttribute("target");

  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || targetAttr === "_blank") {
    return false;
  }

  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin && url.href !== window.location.href;
  } catch {
    return false;
  }
}

const SHOW_AFTER_MS = 150;

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const visibleRef = useRef(visible);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    timerRef.current = null;
    hideTimerRef.current = null;
    showTimerRef.current = null;
  }, []);

  const show = useCallback(() => {
    showTimerRef.current = null;
    visibleRef.current = true;
    setVisible(true);
    setProgress(8);

    timerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current;
        const step = current < 40 ? 9 : current < 70 ? 5 : 2;
        return Math.min(92, current + step);
      });
    }, 180);
  }, []);

  // Only show the bar when a navigation is actually slow; instant ones show nothing.
  const start = useCallback(() => {
    clearTimers();
    showTimerRef.current = window.setTimeout(show, SHOW_AFTER_MS);
  }, [clearTimers, show]);

  const finish = useCallback(() => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (!visibleRef.current) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setProgress(100);
    hideTimerRef.current = window.setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
      setProgress(100);
    }, 280);
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (isSameOriginNavigation(event.target)) {
        markNavigation();
        start();
      }
    };

    const handleSubmit = () => {
      markNavigation();
      start();
    };

    window.addEventListener("click", handleClick, true);
    window.addEventListener("submit", handleSubmit, true);

    return () => {
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("submit", handleSubmit, true);
      clearTimers();
    };
  }, [clearTimers, start]);

  useEffect(() => {
    markNavigation();
    const timer = window.setTimeout(() => finish(), 0);
    return () => window.clearTimeout(timer);
  }, [finish, pathname, searchParams]);

  const scale = Math.max(0, Math.min(100, progress)) / 100;

  if (!mounted) {
    return null;
  }

  return (
    <div className={`${styles.root} ${visible ? styles.visible : styles.panel}`} aria-live="polite" aria-label={`Page loading ${Math.round(progress)} percent`}>
      <div className={styles.track}>
        <div className={styles.bar} style={{ transform: `scaleX(${scale})` }} />
      </div>
      <div className={styles.label} aria-hidden={!visible}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}
