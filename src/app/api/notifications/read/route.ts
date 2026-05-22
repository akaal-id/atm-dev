import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { readPayload, redirectBack, requireApiPermission, wantsJson } from "@/lib/server/api";
import { listResource, updateResource } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const access = await requireApiPermission("notifications:view");
  if (access.error) return access.error;

  const payload = await readPayload(request);
  const notificationId = String(payload.notification_id ?? "").trim();
  const notifications = await listResource("Notifications");
  const mine = notifications.filter((notification) => notification.user_id === access.user.user_id);
  const toMark = mine.filter(
    (notification) =>
      !notification.is_read && (!notificationId || notification.notification_id === notificationId),
  );

  await Promise.all(
    toMark.map((notification) => updateResource("Notifications", notification.notification_id, { is_read: true })),
  );

  revalidatePath("/dashboard", "layout");

  const body = { ok: true, updated: toMark.length };
  return wantsJson(request) ? NextResponse.json(body) : redirectBack(request, "/notifications");
}
