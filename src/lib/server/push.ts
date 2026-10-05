import "server-only";

import { after } from "next/server";
import webpush from "web-push";

import { isSupabaseRestConfigured, supabaseRest } from "@/lib/server/supabase-rest";

/*
 * Web Push (VAPID). Every browser/device that allows notifications stores a subscription;
 * the server sends to it when a notification or chat message is created, even if ATM is closed.
 * Works in Chrome/Edge/Firefox, installed PWAs on Android/desktop, and iOS 16.4+ home-screen apps.
 * Not in embedded webviews (Tauri), which keep the in-page polling fallback.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Opened when the notification is tapped. */
  url: string;
  /** Same tag replaces the previous notification (e.g. one per chat room). */
  tag?: string;
};

type SubscriptionRow = { endpoint: string; user_id: string; p256dh: string; auth: string };

let configured: boolean | null = null;

function ready() {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(publicKey && privateKey && isSupabaseRestConfigured());
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@akaal.id", publicKey!, privateKey!);
  return configured;
}

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

export async function savePushSubscription(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  if (!ready()) throw new Error("Push notifications are not configured on the server.");
  await supabaseRest("/push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      user_id: userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent.slice(0, 300),
      last_seen_at: new Date().toISOString(),
    }),
  });
}

export async function deletePushSubscription(endpoint: string, userId?: string) {
  if (!isSupabaseRestConfigured()) return;
  const owner = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "";
  await supabaseRest(`/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}${owner}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

/** Send to every device of these users. Never throws: push is best-effort next to the in-app list and email. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length || !ready()) return;
  try {
    const list = ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
    const rows = await supabaseRest<SubscriptionRow[]>(`/push_subscriptions?select=endpoint,user_id,p256dh,auth&user_id=in.(${encodeURIComponent(list)})`);
    const body = JSON.stringify(payload);
    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body, { TTL: 60 * 60 * 24, urgency: "high" });
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // The browser unsubscribed or the subscription expired: forget it.
          if (status === 404 || status === 410) await deletePushSubscription(row.endpoint).catch(() => null);
          else console.error("Web push failed", status, (error as Error).message);
        }
      }),
    );
  } catch (error) {
    console.error("Web push lookup failed", error);
  }
}

/** Send after the response is flushed when inside a request; otherwise right away. */
export function sendPushInBackground(userIds: string[], payload: PushPayload) {
  const task = () => sendPushToUsers(userIds, payload);
  try {
    after(task);
  } catch {
    void task();
  }
}

/** A notification row → its push (title, description, link). */
export function pushForNotification(notification: { user_id: string; title: string; description?: string; related_link?: string; notification_id?: string }) {
  sendPushInBackground([notification.user_id], {
    title: notification.title,
    body: notification.description ?? "",
    url: notification.related_link || "/notifications",
    tag: notification.notification_id,
  });
}
