# Push notifications (Web Push)

Added 2026-10-05. Before this, ATM only polled `/api/notifications/unread` every 30 s while a tab was open, so nothing arrived once ATM was closed.

## How it works

1. A device turns push on: on its first tap, or with **Notifications → Turn on**.
   - The browser subscribes with the VAPID public key (`GET /api/push/key`).
   - The subscription is saved with `POST /api/push/subscription` into table `push_subscriptions` (one row per device).
2. **Every in-app notification is pushed.** `createResource("Notifications")` in `src/lib/server/store.ts` calls `pushForNotification()` next to the email.
3. **Every chat message is pushed** to the room's other members (`notifyRoomMembers` in `chat-actions.ts`).
   - There is one notification per room, which updates as new messages arrive.
   - Messages in "My notes" are not pushed.
4. Sending runs **after the response** (`after()`), so actions never wait on push.
5. If a push service answers **404/410**, the subscription is deleted (the device unsubscribed or reinstalled).
6. `public/sw.js` shows the push and opens its link when tapped. It also re-registers if the browser rotates the subscription.
7. **Polling fallback:** devices without a Push API (the Tauri desktop shell, or iPhone Safari outside a home-screen app) keep the 30 s polling while ATM is open. Devices with push skip polling, to avoid duplicates.

- **Code:** `src/lib/server/push.ts` (server), `src/lib/push-client.ts` (browser), `src/components/app/push-toggle`, `src/components/app/device-notifications`
- **Migration:** `docs/migrations/push-subscriptions.sql`
- **Server test:** `.perf/push-server-test.mts` (fake push service; checks VAPID, encryption, payload, and 410 cleanup)

## Configuration

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` must be set in `.env.local` and on the production host (Vercel).

- A backup of the key pair is in `~/.config/atm/vapid.json` on the dev Mac.
- **Never rotate the keys casually.** New keys invalidate every existing subscription, and every user has to turn push on again.
- Without the keys, push is silently disabled and polling still works.

## Where push works

| Device | How to install ATM | Push when ATM is closed |
|---|---|---|
| **Android** | Chrome → ⋮ → **Install app** (or **Add to Home screen**) | ✅ |
| **iPhone / iPad (iOS 16.4+)** | Safari → Share → **Add to Home Screen**, then open ATM *from the home screen* | ✅ (only from the home-screen app) |
| **Windows / macOS** | Chrome or Edge → install icon in the address bar → **Install** (Safari on macOS: File → **Add to Dock**) | ✅ while the browser runs in the background |
| Tauri `.exe` / `.dmg` app | — | ❌ shows notifications only while open (fallback). Prefer the browser install. |
| Android `.apk` (Tauri) | — | ❌ The WebView has no Push API. **Use the Chrome install instead.** |

## Team instructions

1. Install ATM the way your device is listed in the table above.
2. Open ATM and sign in, then go to **Notifications** and tap **Turn on**. Allow notifications when asked.
3. **If the card says "blocked":** open the browser's site settings for team.akaal.id → Notifications → Allow, then reload ATM.
4. **On Android,** also allow **Location** for the attendance clock-in.
