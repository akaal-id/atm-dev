import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { listRoomsForUser } from "@/lib/server/chat-actions";

/** Unread chat messages for the signed-in user (drives the Messages badge) and the rooms to listen to. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rooms = await listRoomsForUser().catch(() => []);
  const total = rooms.reduce((sum, room) => sum + room.unreadCount, 0);
  return NextResponse.json(
    { data: { total, roomIds: rooms.map((room) => room.room_id) } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
