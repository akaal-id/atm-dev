/** Browser side of Web Push: subscribe this device and register it with the server. */

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

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

/** Ask permission if needed, subscribe, and save the subscription for the signed-in user. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return pushState();
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const keyResponse = await fetch("/api/push/key").then((response) => response.json() as Promise<{ data?: { key?: string } }>);
  const key = keyResponse.data?.key;
  if (!key) throw new Error("Push isn't configured on the server yet.");

  const reg = await registration();
  if (!reg) throw new Error("The app's service worker isn't ready. Reload and try again.");
  const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));

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
