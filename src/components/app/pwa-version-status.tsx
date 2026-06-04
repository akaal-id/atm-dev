"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppIcon } from "@/components/app/icons";
import { APP_VERSION } from "@/lib/app-version";
import { cn } from "@/lib/utils";
import styles from "./pwa-version-status.module.css";

type VersionResponse = {
  version?: string;
};

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;

async function fetchLatestVersion() {
  const response = await fetch(`/api/app/version?ts=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as VersionResponse;
  return payload.version?.trim() || null;
}

export function PwaVersionStatus() {
  const [latestVersion, setLatestVersion] = useState(APP_VERSION);
  const [hasWaitingWorker, setHasWaitingWorker] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const shouldReloadRef = useRef(false);

  const updateAvailable = hasWaitingWorker || latestVersion !== APP_VERSION;

  const checkVersion = useCallback(async () => {
    const version = await fetchLatestVersion().catch(() => null);
    if (version) setLatestVersion(version);

    const registration = registrationRef.current;
    if (registration?.waiting) setHasWaitingWorker(true);
    if (!registration?.waiting && "serviceWorker" in navigator) {
      await registration?.update().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const setupServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;

      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (!mounted || !registration) return;

      registrationRef.current = registration;
      if (registration.waiting) setHasWaitingWorker(true);

      const handleUpdateFound = () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setHasWaitingWorker(true);
          }
        });
      };

      registration.addEventListener("updatefound", handleUpdateFound);
      void registration.update();

      return () => {
        registration.removeEventListener("updatefound", handleUpdateFound);
      };
    };

    let cleanupRegistration: (() => void) | undefined;
    void setupServiceWorker().then((cleanup) => {
      cleanupRegistration = cleanup;
    });

    const handleControllerChange = () => {
      if (!shouldReloadRef.current) return;
      window.location.reload();
    };

    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    return () => {
      mounted = false;
      cleanupRegistration?.();
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkVersion(), 0);

    const timer = window.setInterval(() => void checkVersion(), VERSION_CHECK_INTERVAL);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkVersion]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    shouldReloadRef.current = true;

    const registration =
      registrationRef.current ??
      (("serviceWorker" in navigator)
        ? await navigator.serviceWorker.getRegistration("/").catch(() => null)
        : null);
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => window.location.reload(), 1800);
      return;
    }

    await registration?.update().catch(() => undefined);
    window.setTimeout(() => window.location.reload(), 250);
  };

  return (
    <aside
      className={cn(styles.status, updateAvailable ? styles.statusUpdate : styles.statusLatest)}
      aria-live="polite"
      aria-label={`ATM ${APP_VERSION} ${updateAvailable ? "update available" : "latest version"}`}
    >
      <div className={styles.copy}>
        <p className={styles.version}>ATM {APP_VERSION}</p>
        <p className={cn(styles.state, updateAvailable && styles.stateUpdate)}>
          <span className={styles.dot} />
          {updateAvailable ? `Update available${latestVersion !== APP_VERSION ? `: ${latestVersion}` : ""}` : "Latest version"}
        </p>
      </div>

      {updateAvailable ? (
        <button className={styles.button} type="button" onClick={handleUpdate} disabled={isUpdating}>
          <AppIcon name="RefreshCw" className={styles.icon} />
          {isUpdating ? "Updating" : "Update"}
        </button>
      ) : null}
    </aside>
  );
}
