import "server-only";

export { canManageTaskScoring } from "@/lib/permissions";
import type { ScoringConfig } from "@/lib/scoring";
import type { TaskStatus } from "@/lib/types";

const HANDOFF = new Set<string>(["Waiting Approval", "Ready"]);
const REWORK = new Set<string>(["To Do", "In Progress"]);

/** A task sent back from review to work counts as one revision round. */
export function nextRevisionCount(previous: string | undefined, next: TaskStatus | string, count: number | undefined) {
  const current = Math.max(0, Number(count) || 0);
  return previous && HANDOFF.has(previous) && REWORK.has(next) ? current + 1 : current;
}

/**
 * Clean the scoring fields of a task create/update payload, in place.
 * Unknown work types, out-of-range numbers and non-assignee PIC/shares are dropped.
 */
export function sanitizeTaskScoring(
  payload: Record<string, unknown>,
  options: { config: ScoringConfig; assignees: string[]; canManage: boolean },
) {
  const { config, assignees, canManage } = options;

  if ("work_type_id" in payload) {
    const id = String(payload.work_type_id ?? "").trim();
    payload.work_type_id = config.workTypes.some((type) => type.id === id) ? id : "";
  }

  if (!canManage) {
    delete payload.effort_points;
    delete payload.pic_user_id;
    delete payload.contribution_shares;
    delete payload.quality_rating;
    return payload;
  }

  if ("effort_points" in payload) {
    const effort = Number(payload.effort_points);
    payload.effort_points = payload.effort_points === "" || payload.effort_points === null || !Number.isFinite(effort) || effort <= 0 ? null : Math.min(40, Math.round(effort * 2) / 2);
  }

  if ("pic_user_id" in payload) {
    const pic = String(payload.pic_user_id ?? "").trim();
    payload.pic_user_id = assignees.includes(pic) ? pic : "";
  }

  if ("contribution_shares" in payload) {
    let raw = payload.contribution_shares;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = {};
      }
    }
    const shares = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    payload.contribution_shares = Object.fromEntries(
      Object.entries(shares)
        .filter(([userId]) => assignees.includes(userId))
        .map(([userId, share]) => [userId, Math.max(0, Math.min(100, Number(share) || 0))] as const)
        .filter(([, share]) => share > 0),
    );
  }

  if ("quality_rating" in payload) {
    const rating = Math.round(Number(payload.quality_rating));
    payload.quality_rating = rating >= 1 && rating <= 5 ? rating : null;
  }

  return payload;
}
