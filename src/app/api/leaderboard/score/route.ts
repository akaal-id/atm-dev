import { NextResponse, type NextRequest } from "next/server";

import { cleanEmptyStrings, normalizePayload, readPayload, redirectBack, wantsJson } from "@/lib/server/api";
import { getCurrentUser } from "@/lib/server/auth";
import { createResource, listResource } from "@/lib/server/store";
import type { CurrentUser, GamificationPoint } from "@/lib/types";

function canManageScore(user: CurrentUser | null) {
  return Boolean(user && (user.role_id === "super_admin" || user.role_id === "admin" || user.employment_status === "Manager"));
}

function scoreForUser(points: GamificationPoint[], userId: string) {
  return points.filter((point) => point.user_id === userId).reduce((total, point) => total + Number(point.points || 0), 0);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageScore(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = normalizePayload(cleanEmptyStrings(await readPayload(request)));
  const targetUserId = String(payload.user_id ?? "");
  const mode = String(payload.mode ?? "adjust");
  const reason = String(payload.reason ?? "Manual leaderboard adjustment").trim() || "Manual leaderboard adjustment";

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const points = await listResource("Gamification_Points");
  const currentScore = scoreForUser(points, targetUserId);
  const requestedPoints = Number(mode === "set_total" ? payload.target_score : payload.points);

  if (!Number.isFinite(requestedPoints)) {
    return NextResponse.json({ error: "Invalid points value" }, { status: 400 });
  }

  const adjustment = mode === "set_total" ? requestedPoints - currentScore : requestedPoints;

  if (adjustment === 0) {
    return wantsJson(request) ? NextResponse.json({ ok: true, adjustment: 0 }) : redirectBack(request, "/leaderboard");
  }

  const now = new Date().toISOString();
  const record = await createResource("Gamification_Points", {
    user_id: targetUserId,
    source_type: mode === "set_total" ? "manual_score_set" : "manual_adjustment",
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

  return wantsJson(request) ? NextResponse.json({ data: record }) : redirectBack(request, "/leaderboard");
}
