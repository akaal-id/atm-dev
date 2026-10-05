/** Browser side of Web Push: subscribe this device and register it with the server. */

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** The browser couldn't register with its push service (FCM etc.). Not an ATM server problem. */
export class PushServiceError extends Error {
  constructor() {
    super("Your browser couldn't register with its push service.");
    this.name = "PushServiceError";
  }
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a) return false;
  const view = new Uint8Array(a);
  return view.length === b.length && view.every((byte, index) => byte === b[index]);
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Subscribe, replacing a subscription made with an old VAPID key, and retry once:
 * Chromium's "Registration failed - push service error" is often transient.
 */
async function subscribe(reg: ServiceWorkerRegistration, key: Uint8Array) {
  const existing = await reg.pushManager.getSubscription();
  if (existing && sameKey(existing.options.applicationServerKey, key)) return existing;
  if (existing) await existing.unsubscribe().catch(() => false);
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource });
    } catch (error) {
      const name = (error as DOMException)?.name;
      const serviceError = name === "AbortError" || /push service/i.test((error as Error)?.message ?? "");
      if (!serviceError) throw error;
      if (attempt >= 1) throw new PushServiceError();
      await wait(1500);
    }
  }
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready.catch(() => null));
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const subscription = await reg?.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

let enabling: Promise<PushState> | null = null;

/**
 * Ask permission if needed, subscribe, and save the subscription for the signed-in user.
 * Single-flight: the background sync and the Turn on button often fire together, and parallel
 * subscribe() calls race (and could unsubscribe each other's fresh subscription).
 */
export function enablePush(): Promise<PushState> {
  enabling ??= enablePushOnce().finally(() => {
    enabling = null;
  });
  return enabling;
}

async function enablePushOnce(): Promise<PushState> {
  if (!pushSupported()) return pushState();
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const keyResponse = await fetch("/api/push/key").then((response) => response.json() as Promise<{ data?: { key?: string } }>);
  const key = keyResponse.data?.key;
  if (!key) throw new Error("Push isn't configured on the server yet.");

  const reg = await registration();
  if (!reg) throw new Error("The app's service worker isn't ready. Reload and try again.");
  const subscription = await subscribe(reg, urlBase64ToUint8Array(key));

  const saved = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!saved.ok) {
    const body = (await saved.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Could not register this device.");
  }
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) {
    await fetch("/api/push/subscription", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => null);
    await subscription.unsubscribe().catch(() => false);
  }
  return pushState();
}

export type PushEnv = {
  os: "macos" | "windows" | "android" | "ios" | "linux" | "other";
  browser: "chrome" | "edge" | "brave" | "opera" | "arc" | "firefox" | "safari" | "samsung" | "other";
  /** Inside the Tauri desktop app (system webview: no Web Push). */
  desktopApp: boolean;
  /** Installed PWA / home-screen / Dock app window. */
  standalone: boolean;
  mobile: boolean;
};

function detectBrowser(ua: string): PushEnv["browser"] {
  if (/SamsungBrowser/.test(ua)) return "samsung";
  // Brave and Arc send a plain Chrome user agent; they give themselves away elsewhere.
  if ("brave" in navigator) return "brave";
  if (/OPR\//.test(ua)) return "opera";
  if (getComputedStyle(document.documentElement).getPropertyValue("--arc-palette-title") !== "") return "arc";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

/** Where ATM is running, so the push prompt can give exact, device-specific steps. */
export function pushEnv(): PushEnv {
  const ua = navigator.userAgent;
  const os: PushEnv["os"] = isIos() ? "ios" : /Android/.test(ua) ? "android" : /Mac OS X/.test(ua) ? "macos" : /Windows/.test(ua) ? "windows" : /Linux/.test(ua) ? "linux" : "other";
  const browser = detectBrowser(ua);
  const tauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  // Desktop system webviews (WKWebView / WebView2 shells) lack the Push API and the usual browser tokens.
  const embeddedWebview = (os === "macos" || os === "windows") && !("PushManager" in window) && !/(Safari|Firefox)\//.test(ua);
  return { os, browser, desktopApp: tauri || embeddedWebview, standalone: isStandalone(), mobile: os === "android" || os === "ios" };
}

/** Sends a test notification to this device only. */
export async function sendTestPush() {
  const reg = await registration();
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) throw new Error("Turn notifications on first.");
  const send = () =>
    fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  let response = await send();
  if (response.status === 404) {
    // The browser is subscribed but the server dropped the row (e.g. after a push-service error): re-register once.
    const saved = await fetch("/api/push/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (saved.ok) response = await send();
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Couldn't send a test notification.");
  }
}
