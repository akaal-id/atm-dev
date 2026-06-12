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

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
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
    timerRef.current = null;
    hideTimerRef.current = null;
  }, []);

  const start = useCallback(() => {
    clearTimers();
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
  }, [clearTimers]);

  const finish = useCallback(() => {
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
    const startTimer = window.setTimeout(() => {
      visibleRef.current = true;
      setVisible(true);
      setProgress(12);
    }, 0);

    const timer = window.setTimeout(() => {
      setProgress(100);
      hideTimerRef.current = window.setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
      }, 280);
    }, 360);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(timer);
    };
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
    <div className={`${styles.root} ${visible ? styles.visible : styles.hidden}`} aria-live="polite" aria-label={`Page loading ${Math.round(progress)} percent`}>
      <div className={styles.track}>
        <div className={styles.bar} style={{ transform: `scaleX(${scale})` }} />
      </div>
      <div className={styles.label} aria-hidden={!visible}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}
