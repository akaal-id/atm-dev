import "server-only";

import { createResource, listResource } from "@/lib/server/store";
import { isSupabaseRestConfigured, supabaseRest } from "@/lib/server/supabase-rest";

/*
 * Points ledger. Since leaderboard v2 (2026-10-02, docs/leaderboard-plan.md) the score is
 * computed from tasks and attendance directly; the v1 automatic awards (task_done,
 * task_overdue, punctual_attendance) are frozen as lifetime XP. The ledger still records
 * manual adjustments and Off-site penalties.
 */

type AwardKeyRow = { user_id: string; source_type: string; source_id: string };
const awardKey = (row: AwardKeyRow) => `${row.user_id}:${row.source_type}:${row.source_id}`;
const PAGE = 1000; // PostgREST returns at most 1000 rows per request

/**
 * Keys of points already awarded for these sources. Reads every matching row
 * (paged) — a plain list stops at PostgREST's 1000-row cap, which previously made
 * the app re-award the same points on every leaderboard visit.
 */
async function existingAwardKeys(sourceIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(sourceIds.filter(Boolean))];
  if (process.env.ATM_DATA_MODE !== "supabase" || !isSupabaseRestConfigured()) {
    const all = (await listResource("Gamification_Points")) as AwardKeyRow[];
    return new Set(all.map(awardKey));
  }
  const keys = new Set<string>();
  const chunks = Array.from({ length: Math.ceil(ids.length / 40) }, (_, index) => ids.slice(index * 40, index * 40 + 40));
  await Promise.all(
    chunks.map(async (chunk) => {
      const list = encodeURIComponent(chunk.map((id) => `"${id.replace(/"/g, "")}"`).join(","));
      for (let offset = 0; ; offset += PAGE) {
        const rows = await supabaseRest<AwardKeyRow[]>(
          `/gamification_points?select=user_id,source_type,source_id&source_id=in.(${list})&order=point_id.asc&limit=${PAGE}&offset=${offset}`,
        );
        rows.forEach((row) => keys.add(awardKey(row)));
        if (rows.length < PAGE) break;
      }
    }),
  );
  return keys;
}

/** A unique-constraint conflict means another request already awarded these points. */
function ignoreDuplicateAward(error: unknown) {
  const text = error instanceof Error ? `${error.message} ${(error as { status?: number }).status ?? ""}` : String(error);
  if (/\b409\b|23505|duplicate key|gamification_points_award_unique/.test(text)) return null;
  throw error;
}

export async function awardPointsOnce({
  userId,
  sourceType,
  sourceId,
  points,
  reason,
}: {
  userId: string;
  sourceType: string;
  sourceId: string;
  points: number;
  reason: string;
}) {
  if (!userId || !sourceType || !sourceId || points === 0) return null;

  const existing = await existingAwardKeys([sourceId]);
  if (existing.has(`${userId}:${sourceType}:${sourceId}`)) return null;

  return createResource("Gamification_Points", {
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId,
    points,
    reason,
    created_at: new Date().toISOString(),
  }).catch(ignoreDuplicateAward);
}
