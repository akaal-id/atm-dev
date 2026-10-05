"use client";

import { useEffect, useRef } from "react";

import { enablePush, pushState, pushSupported } from "@/lib/push-client";
import type { AppNotification } from "@/lib/types";

const STORAGE_KEY = "atm_device_notified_ids";

function readShownIds() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function saveShownIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-100)));
  } catch {
    // Storage blocked: worst case a notification is shown twice.
  }
}

async function showDeviceNotification(notification: AppNotification) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const options: NotificationOptions = {
    body: notification.description,
    icon: "/icon/atm-icon-192.png",
    badge: "/icon/atm-icon-192.png",
    tag: notification.notification_id,
    data: { url: notification.related_link || "/notifications" },
  };

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (registration) {
      await registration.showNotification(notification.title, options);
      return;
    }
  }

  const item = new Notification(notification.title, options);
  item.onclick = () => {
    window.focus();
    window.location.href = notification.related_link || "/notifications";
  };
}

/**
 * Device notifications.
 * - Web Push (preferred): this device subscribes once; the server pushes even when ATM is closed.
 * - Fallback (no Push API, e.g. the Tauri desktop shell or an iPhone browser tab): poll every
 *   30 s while ATM is open and show new notifications locally.
 */
export function DeviceNotifications() {
  const requestedRef = useRef(false);

  // First tap anywhere asks for permission (browsers require a user gesture), then subscribes.
  useEffect(() => {
    if (!("Notification" in window)) return;

    const onGesture = () => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      if (Notification.permission === "denied") return;
      if (pushSupported()) void enablePush().catch(() => null);
      else if (Notification.permission === "default") void Notification.requestPermission();
    };

    // Already allowed earlier: make sure this device's subscription is registered (no prompt).
    if (Notification.permission === "granted" && pushSupported()) void enablePush().catch(() => null);

    window.addEventListener("click", onGesture, { once: true });
    return () => window.removeEventListener("click", onGesture);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      // With an active push subscription the server delivers; polling would show duplicates.
      if ((await pushState()) === "on") return;

      const response = await fetch("/api/notifications/unread", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;

      const payload = (await response.json()) as { data?: AppNotification[] };
      const shownIds = readShownIds();
      const freshNotifications = (payload.data ?? []).filter((notification) => !shownIds.has(notification.notification_id)).reverse();

      for (const notification of freshNotifications) {
        shownIds.add(notification.notification_id);
        await showDeviceNotification(notification);
      }

      if (freshNotifications.length > 0) saveShownIds(shownIds);
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
