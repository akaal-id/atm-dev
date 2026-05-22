import { NextResponse, type NextRequest } from "next/server";

import { readPayload, redirectBack, requireApiPermission, wantsJson } from "@/lib/server/api";
import { listResource, updateResource } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const access = await requireApiPermission("notifications:view");
  if (access.error) return access.error;

  const payload = await readPayload(request);
  const notificationId = String(payload.notification_id ?? "");
  const notifications = await listResource("Notifications");
  const mine = notifications.filter((notification) => notification.user_id === access.user.user_id);

  await Promise.all(
    mine
      .filter((notification) => !notificationId || notification.notification_id === notificationId)
      .map((notification) => updateResource("Notifications", notification.notification_id, { is_read: true })),
  );

  return wantsJson(request) ? NextResponse.json({ ok: true }) : redirectBack(request, "/notifications");
}
