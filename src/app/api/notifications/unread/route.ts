import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/server/api";
import { listResourceByField } from "@/lib/server/store";

export async function GET() {
  const access = await requireApiPermission("notifications:view");
  if (access.error) return access.error;

  const notifications = (await listResourceByField("Notifications", "user_id", access.user.user_id, {
    orderBy: "created_at",
    limit: 20,
  })).filter((notification) => !notification.is_read);

  return NextResponse.json({ data: notifications });
}
