import { NextResponse } from "next/server";

import { vapidPublicKey } from "@/lib/server/push";

/** VAPID public key the browser needs to subscribe (served at runtime, so no rebuild per environment). */
export async function GET() {
  const key = vapidPublicKey();
  return NextResponse.json({ data: { key, enabled: Boolean(key) } }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
