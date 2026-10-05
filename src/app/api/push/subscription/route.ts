import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { deletePushSubscription, savePushSubscription } from "@/lib/server/push";

type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Register this browser/device for push notifications for the signed-in user. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  const endpoint = String(body?.endpoint ?? "");
  const p256dh = String(body?.keys?.p256dh ?? "");
  const auth = String(body?.keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  try {
    await savePushSubscription(user.user_id, { endpoint, keys: { p256dh, auth } }, request.headers.get("user-agent") ?? "");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save subscription." }, { status: 503 });
  }
  return NextResponse.json({ data: { ok: true } });
}

/** Turn push off for this device. */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  await deletePushSubscription(body.endpoint, user.user_id);
  return NextResponse.json({ data: { ok: true } });
}
