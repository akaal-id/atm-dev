const APP_VERSION = "V2.2";
const CACHE_NAME = "atm-pwa-v2-2";
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [
  OFFLINE_URL,
  "/icon/atm-icon-192.png",
  "/icon/atm-icon-512.png",
  "/icon/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "GET_VERSION") {
    event.source?.postMessage({ type: "APP_VERSION", version: APP_VERSION });
  }
});

function shouldBypassRuntimeCache(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith("/_next/")) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.searchParams.has("_rsc")) return true;
  if (request.headers.get("accept")?.includes("text/x-component")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(OFFLINE_URL);
      }),
    );
    return;
  }

  if (request.method !== "GET") return;
  if (shouldBypassRuntimeCache(request)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (response.ok && new URL(request.url).origin === self.location.origin) {
              cache.put(request, copy);
            }
          });
          return response;
        })
        .catch(() => cached);
    }),
  );
});

// Web Push from the server (works while ATM is closed). Payload: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "ATM";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icon/atm-icon-192.png",
      badge: "/icon/atm-icon-192.png",
      tag: payload.tag || undefined,
      renotify: Boolean(payload.tag),
      data: { url: payload.url || "/notifications" },
    }),
  );
});

// The browser rotated the subscription: re-register it with the server.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    fetch("/api/push/key")
      .then((response) => response.json())
      .then(({ data }) =>
        self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.key) }),
      )
      .then((subscription) =>
        fetch("/api/push/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(subscription.toJSON()),
        }),
      )
      .catch(() => undefined),
  );
});

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/notifications";
  const url = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => client.url === url) || clients.find((client) => new URL(client.url).origin === self.location.origin);
        if (existing) return existing.focus().then((client) => (client.url === url ? client : client.navigate(url)));
        return self.clients.openWindow(url);
      }),
  );
});
