import { NextResponse, type NextRequest } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { cleanEmptyStrings, normalizePayload, readPayload, redirectBack, wantsJson } from "@/lib/server/api";
import { getCurrentUser } from "@/lib/server/auth";
import { createResource } from "@/lib/server/store";
import type { CurrentUser } from "@/lib/types";

/** Manual adjustments are a Settings tool now; they add ± points to the score of the month they're made in. */
function canManageScore(user: CurrentUser | null) {
  return Boolean(user && hasPermission(user.role_id, "settings:manage"));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageScore(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = normalizePayload(cleanEmptyStrings(await readPayload(request)));
  const targetUserId = String(payload.user_id ?? "");
  const reason = String(payload.reason ?? "Manual leaderboard adjustment").trim() || "Manual leaderboard adjustment";

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const adjustment = Math.round(Number(payload.points));
  if (!Number.isFinite(adjustment) || Math.abs(adjustment) > 50) {
    return NextResponse.json({ error: "Adjust by a whole number between -50 and 50." }, { status: 400 });
  }
  if (!String(payload.reason ?? "").trim()) {
    return NextResponse.json({ error: "A reason is required." }, { status: 400 });
  }

  if (adjustment === 0) {
    return wantsJson(request) ? NextResponse.json({ ok: true, adjustment: 0 }) : redirectBack(request, "/admin/gamification-settings");
  }

  const now = new Date().toISOString();
  const record = await createResource("Gamification_Points", {
    user_id: targetUserId,
    source_type: "manual_adjustment",
    source_id: `manual_${targetUserId}_${Date.now()}`,
    points: adjustment,
    reason: `${reason} by ${user.full_name}`,
    created_at: now,
  });

  await createResource("Activity_Logs", {
    user_id: user.user_id,
    action: "updated",
    entity_type: "Gamification_Points",
    entity_id: String((record as { point_id?: string }).point_id ?? ""),
    description: `${user.full_name} adjusted ${targetUserId}'s leaderboard score by ${adjustment} points.`,
    created_at: now,
  });

  return wantsJson(request) ? NextResponse.json({ data: record }) : redirectBack(request, "/admin/gamification-settings");
}
