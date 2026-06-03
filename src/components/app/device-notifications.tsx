"use client";

import { useEffect, useRef } from "react";

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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-100)));
}

async function showDeviceNotification(notification: AppNotification) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const options: NotificationOptions = {
    body: notification.description,
    icon: "/icon.svg",
    badge: "/icon.svg",
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

export function DeviceNotifications() {
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!("Notification" in window)) return;

    const requestOnGesture = () => {
      if (requestedRef.current || Notification.permission !== "default") return;
      requestedRef.current = true;
      void Notification.requestPermission();
    };

    window.addEventListener("click", requestOnGesture, { once: true });
    return () => window.removeEventListener("click", requestOnGesture);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;

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
