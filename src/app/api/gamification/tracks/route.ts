import { NextResponse, type NextRequest } from "next/server";

import { isScoreTrack } from "@/lib/scoring";
import { requireApiPermission } from "@/lib/server/api";
import { getResourceById, updateResource } from "@/lib/server/store";

/** Put a person on a leaderboard track (Design, Copywriting, …, Leader). */
export async function PATCH(request: NextRequest) {
  const access = await requireApiPermission("settings:manage");
  if ("error" in access) return access.error;
  const body = (await request.json().catch(() => null)) as { user_id?: string; track?: string } | null;
  const userId = String(body?.user_id ?? "");
  const track = String(body?.track ?? "");
  if (!userId || (track !== "" && !isScoreTrack(track))) return NextResponse.json({ error: "Choose a person and a valid track." }, { status: 400 });
  if (!(await getResourceById("Users", userId))) return NextResponse.json({ error: "Person not found." }, { status: 404 });
  await updateResource("Users", userId, { score_track: track, updated_at: new Date().toISOString() } as never);
  return NextResponse.json({ data: { user_id: userId, track } });
}
