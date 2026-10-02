import "server-only";

import { listResource } from "@/lib/server/store";
import { isSupabaseRestConfigured, supabaseRest } from "@/lib/server/supabase-rest";
import type { AttendanceHistoryRow } from "@/lib/attendance-history";

type SessionRow = {
  id: string;
  user_id: string;
  date: string;
  status: string;
  total_active_minutes: number;
  eod_summary: string | null;
  work_mode: string | null;
  base_distance_m: number | null;
};
type LegacyRow = { user_id: string; date: string; clock_in: string; clock_out: string; status: string; active_minutes: number | null; note: string };

const PAGE = 1000;

async function readAll<T>(path: string) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await supabaseRest<T[]>(`${path}&limit=${PAGE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/**
 * Attendance between two dates (inclusive) for the given users — one row per user per day.
 * Work mode, active time and EOD come from time-tracking sessions; clock times from the
 * attendance log. Only the requested date range (and, with one user, only their rows) is read.
 */
export async function getAttendanceHistory(start: string, end: string, users: Array<{ user_id: string; full_name: string; profile_photo?: string }>): Promise<AttendanceHistoryRow[]> {
  const names = new Map(users.map((user) => [user.user_id, user.full_name]));
  const photos = new Map(users.map((user) => [user.user_id, user.profile_photo ?? ""]));
  const onlyUser = users.length === 1 ? `&user_id=eq.${encodeURIComponent(users[0].user_id)}` : "";
  const range = `date=gte.${start}&date=lte.${end}${onlyUser}`;
  if (!isSupabaseRestConfigured()) return legacyHistory(start, end, names, photos);
  const [sessions, legacy] = await Promise.all([
    readAll<SessionRow>(`/attendance_sessions?select=id,user_id,date,status,total_active_minutes,eod_summary,work_mode,base_distance_m&${range}&order=date.desc,id.asc`),
    readAll<LegacyRow>(`/attendance?select=user_id,date,clock_in,clock_out,status,active_minutes,note&${range}&order=date.desc,attendance_id.asc`),
  ]);

  const rows = new Map<string, AttendanceHistoryRow>();
  for (const row of legacy) {
    if (!names.has(row.user_id)) continue;
    rows.set(`${row.user_id}:${row.date}`, {
      date: row.date,
      user_id: row.user_id,
      name: names.get(row.user_id)!,
      photo: photos.get(row.user_id) ?? "",
      clock_in: row.clock_in || "",
      clock_out: row.clock_out || "",
      active_minutes: Number(row.active_minutes ?? 0),
      work_mode: "",
      distance_m: null,
      status: row.status,
      eod: row.note || "",
    });
  }
  for (const session of sessions) {
    if (!names.has(session.user_id)) continue;
    const key = `${session.user_id}:${session.date}`;
    const base = rows.get(key);
    rows.set(key, {
      date: session.date,
      user_id: session.user_id,
      name: names.get(session.user_id)!,
      photo: photos.get(session.user_id) ?? "",
      clock_in: base?.clock_in ?? "",
      clock_out: base?.clock_out ?? "",
      active_minutes: Number(session.total_active_minutes ?? base?.active_minutes ?? 0),
      work_mode: session.work_mode ?? "",
      distance_m: session.base_distance_m,
      status: session.status || base?.status || "",
      eod: session.eod_summary || base?.eod || "",
    });
  }
  return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** Seed / Sheets mode: no time-tracking sessions, only the attendance log. */
async function legacyHistory(start: string, end: string, names: Map<string, string>, photos: Map<string, string>): Promise<AttendanceHistoryRow[]> {
  const rows = await listResource("Attendance");
  return rows
    .filter((row) => names.has(row.user_id) && row.date >= start && row.date <= end)
    .map((row) => ({
      date: row.date,
      user_id: row.user_id,
      name: names.get(row.user_id)!,
      photo: photos.get(row.user_id) ?? "",
      clock_in: row.clock_in || "",
      clock_out: row.clock_out || "",
      active_minutes: Number(row.active_minutes ?? 0),
      work_mode: "",
      distance_m: null,
      status: row.status,
      eod: row.note || "",
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** Today's time-tracking session per user (work mode + status), for the dashboard's team summary. */
export async function sessionsOn(date: string): Promise<Record<string, { work_mode: string; status: string }>> {
  if (!isSupabaseRestConfigured()) return {};
  const rows = await readAll<{ user_id: string; work_mode: string | null; status: string }>(`/attendance_sessions?select=user_id,work_mode,status&date=eq.${date}&order=id.asc`);
  return Object.fromEntries(rows.map((row) => [row.user_id, { work_mode: row.work_mode ?? "", status: row.status }]));
}
