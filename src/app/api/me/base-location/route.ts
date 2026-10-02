import { NextResponse, type NextRequest } from "next/server";

import { requireApiPermission } from "@/lib/server/api";
import { updateResource } from "@/lib/server/store";

/** Set the signed-in user's home location (WFH base). The office is company-wide, not per user. */
export async function PATCH(request: NextRequest) {
  const access = await requireApiPermission("attendance:own");
  if ("error" in access) return access.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }
  const label = String(body?.label ?? "").trim().slice(0, 160);

  const user = await updateResource("Users", access.user.user_id, {
    home_lat: lat,
    home_lng: lng,
    home_label: label,
    updated_at: new Date().toISOString(),
  } as never);
  return NextResponse.json({ data: { lat, lng, label, updated: Boolean(user) } });
}
