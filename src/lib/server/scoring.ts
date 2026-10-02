import "server-only";

import {
  type AttendanceDay,
  computeScores,
  defaultTrack,
  type LeaderboardPeriodView,
  lifetimeXp,
  type LedgerEntry,
  parseScoringConfig,
  type PersonScore,
  type ScoringConfig,
  scoringPeriod,
  type ScoringTask,
} from "@/lib/scoring";
import { jakartaToday } from "@/lib/metrics";
import { createResource, listResource, updateResource } from "@/lib/server/store";
import { isSupabaseRestConfigured, supabaseRest } from "@/lib/server/supabase-rest";
import type { CurrentUser, Setting } from "@/lib/types";

export const SCORING_SETTING_KEY = "gamification_v2";

/** Ledger sources from the v1 rules — frozen into lifetime XP, no longer scored. */
const LEGACY_SOURCES = new Set(["task_done", "task_overdue", "punctual_attendance"]);

async function scoringSetting() {
  const settings = (await listResource("Settings")) as Setting[];
  return settings.find((setting) => setting.setting_key === SCORING_SETTING_KEY);
}

export async function getScoringConfig(): Promise<ScoringConfig> {
  return parseScoringConfig((await scoringSetting())?.setting_value);
}

export async function saveScoringConfig(config: ScoringConfig, user: Pick<CurrentUser, "user_id">) {
  const value = JSON.stringify(parseScoringConfig(config));
  const existing = await scoringSetting();
  const now = new Date().toISOString();
  if (existing) {
    return updateResource("Settings", existing.setting_id, { setting_value: value, updated_by: user.user_id, updated_at: now });
  }
  return createResource("Settings", {
    setting_key: SCORING_SETTING_KEY,
    setting_value: value,
    setting_type: "json",
    updated_by: user.user_id,
    updated_at: now,
  });
}

const PAGE = 1000;

type SessionRow = { user_id: string; date: string; status: string; eod_summary: string | null };

/** Workdays in range from time-tracking sessions, falling back to the legacy attendance log. */
async function attendanceDays(start: string, end: string, userIds: Set<string>): Promise<AttendanceDay[]> {
  const days = new Map<string, AttendanceDay>();
  const legacy = await listResource("Attendance");
  for (const row of legacy) {
    if (!userIds.has(row.user_id) || row.date < start || row.date > end) continue;
    days.set(`${row.user_id}:${row.date}`, {
      user_id: row.user_id,
      date: row.date,
      onTime: row.status === "Present" || (row.status as string) === "On Time",
      eod: Boolean(row.note?.trim()),
    });
  }
  if (isSupabaseRestConfigured()) {
    for (let offset = 0; ; offset += PAGE) {
      const rows = await supabaseRest<SessionRow[]>(
        `/attendance_sessions?select=user_id,date,status,eod_summary&date=gte.${start}&date=lte.${end}&order=date.asc,id.asc&limit=${PAGE}&offset=${offset}`,
      );
      for (const row of rows) {
        if (!userIds.has(row.user_id) || row.status === "Leave") continue;
        days.set(`${row.user_id}:${row.date}`, {
          user_id: row.user_id,
          date: row.date,
          onTime: row.status === "On Time" || row.status === "Present",
          eod: Boolean(row.eod_summary?.trim()),
        });
      }
      if (rows.length < PAGE) break;
    }
  }
  return [...days.values()];
}

export type LeaderboardData = {
  config: ScoringConfig;
  view: LeaderboardPeriodView;
  anchor: string;
  period: { start: string; end: string; prev: string; next: string };
  rows: Array<PersonScore & { rank: number; previousRank: number | null; xp: number; photo: string }>;
  departments: Array<{ department_id: string; department_name: string }>;
};

/**
 * Everyone's score for the period, their rank movement vs the previous period, and lifetime XP.
 * Ranking is on the normalised 0–100 score, so tracks are comparable.
 */
export async function getLeaderboard(view: LeaderboardPeriodView, anchor: string): Promise<LeaderboardData> {
  const today = jakartaToday();
  const period = scoringPeriod(view, anchor);
  const previous = scoringPeriod(view, period.prev);
  const [config, allUsers, tasks, ledgerRows, departments] = await Promise.all([
    getScoringConfig(),
    listResource("Users"),
    listResource("Tasks"),
    listResource("Gamification_Points"),
    listResource("Departments"),
  ]);
  // Owners don't do delivery work; keep them off the board.
  const users = allUsers.filter((user) => user.is_active && user.role_id !== "org_owner");
  const userIds = new Set(users.map((user) => user.user_id));
  const scoringUsers = users.map((user) => ({ ...user, score_track: defaultTrack(user) }));
  const ledger: LedgerEntry[] = ledgerRows.map((row) => ({ user_id: row.user_id, source_type: row.source_type, points: Number(row.points || 0), created_at: row.created_at, reason: row.reason }));
  const attendance = await attendanceDays(previous.start, period.end, userIds);

  const run = (range: { start: string; end: string }) =>
    computeScores({ tasks: tasks as ScoringTask[], users: scoringUsers, attendance, ledger, config, period: { start: range.start, end: range.end, today } });
  const current = run(period);
  const before = run(previous);
  const previousRank = new Map(before.filter((row) => row.score > 0).map((row, index) => [row.user_id, index + 1]));

  const allTime = computeScores({ tasks: tasks as ScoringTask[], users: scoringUsers, attendance: [], ledger: [], config, period: { start: "2000-01-01", end: today, today } });
  const creditedAllTime = new Map(allTime.map((row) => [row.user_id, row.stats.credited]));
  const legacy = new Map<string, number>();
  ledger.filter((entry) => LEGACY_SOURCES.has(entry.source_type)).forEach((entry) => legacy.set(entry.user_id, (legacy.get(entry.user_id) ?? 0) + entry.points));
  const photos = new Map(users.map((user) => [user.user_id, user.profile_photo || ""]));

  return {
    config,
    view,
    anchor,
    period,
    rows: current.map((row, index) => ({
      ...row,
      rank: index + 1,
      previousRank: previousRank.get(row.user_id) ?? null,
      xp: lifetimeXp(legacy.get(row.user_id) ?? 0, creditedAllTime.get(row.user_id) ?? 0),
      photo: photos.get(row.user_id) ?? "",
    })),
    departments: departments.map((department) => ({ department_id: department.department_id, department_name: department.department_name })),
  };
}

export type MonthScore = { score: number; rank: number; xp: number; of: number };

/** This month's leaderboard score, rank and lifetime XP per user (for the directory and profiles). */
export async function currentMonthScores(): Promise<Record<string, MonthScore>> {
  const board = await getLeaderboard("month", jakartaToday());
  return Object.fromEntries(board.rows.map((row) => [row.user_id, { score: row.score, rank: row.rank, xp: row.xp, of: board.rows.length }]));
}
