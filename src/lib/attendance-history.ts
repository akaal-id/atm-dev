/** Shared attendance history types and date-range helpers (client + server). Dates are YYYY-MM-DD. */

export type AttendanceHistoryRow = {
  date: string;
  user_id: string;
  name: string;
  photo: string;
  clock_in: string;
  clock_out: string;
  active_minutes: number;
  work_mode: string;
  distance_m: number | null;
  status: string;
  eod: string;
};

export type HistoryView = "day" | "week" | "month";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const utc = (value: string) => new Date(`${value}T00:00:00Z`);
const addDays = (value: string, days: number) => {
  const date = utc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
};

import { jakartaToday } from "@/lib/metrics";

export { jakartaToday };

/** The day / week (Mon–Sun) / month containing `anchor`, plus the anchors of the previous and next period. */
export function periodRange(view: HistoryView, anchor: string) {
  if (view === "day") return { start: anchor, end: anchor, prev: addDays(anchor, -1), next: addDays(anchor, 1) };
  if (view === "week") {
    const weekday = (utc(anchor).getUTCDay() + 6) % 7; // Monday = 0
    const start = addDays(anchor, -weekday);
    return { start, end: addDays(start, 6), prev: addDays(start, -7), next: addDays(start, 7) };
  }
  const date = utc(anchor);
  const start = iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
  const end = iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
  return { start, end, prev: addDays(start, -1), next: addDays(end, 1) };
}

export type ReportPreset = "this_month" | "last_30" | "last_90" | "last_180";

export const reportPresets: Array<{ id: ReportPreset; label: string }> = [
  { id: "this_month", label: "This month" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_90", label: "Last 3 months" },
  { id: "last_180", label: "Last 6 months" },
];

export function presetRange(preset: ReportPreset, today = jakartaToday()) {
  if (preset === "this_month") return { start: `${today.slice(0, 8)}01`, end: today };
  const days = preset === "last_30" ? 30 : preset === "last_90" ? 90 : 180;
  return { start: addDays(today, -(days - 1)), end: today };
}

export const MAX_REPORT_DAYS = 366;

export function daysBetween(start: string, end: string) {
  return Math.round((utc(end).getTime() - utc(start).getTime()) / 86_400_000) + 1;
}

export function formatActive(minutes: number) {
  if (!minutes) return "-";
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
