import "server-only";

import { awardPunctualAttendancePoints } from "@/lib/server/gamification";
import { createResource, listResourceByField, updateResource } from "@/lib/server/store";
import type { Attendance, AttendanceStatus } from "@/lib/types";

export const attendanceEventTypes = ["clock_in", "transit_pause", "resume", "clock_out"] as const;

export type AttendanceEventType = (typeof attendanceEventTypes)[number];
export type AttendanceTerminalMode = "none" | "working" | "paused" | "closed";

export interface AttendanceSessionRecord {
  id: string;
  user_id: string;
  date: string;
  status: "On Time" | "Late" | "Present" | "Leave" | "System Auto-Closed";
  total_active_minutes: number;
  eod_summary: string | null;
  created_at: string;
}

export interface AttendanceEventRecord {
  id: string;
  session_id: string;
  event_type: AttendanceEventType;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface AttendanceTerminalState {
  session: AttendanceSessionRecord | null;
  events: AttendanceEventRecord[];
  state: AttendanceTerminalMode;
  activeMinutes: number;
  lastEvent: AttendanceEventRecord | null;
}

interface LogAttendanceEventInput {
  eventType: AttendanceEventType;
  eodSummary?: string;
  lat: number;
  lng: number;
  userId: string;
}

interface SupabaseInsertOptions {
  prefer?: string;
}

export class AttendanceTimeTrackingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AttendanceTimeTrackingError";
  }
}

function supabaseUrl() {
  const explicitUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");

  const projectId = process.env.SUPABASE_PROJECT_ID;
  return projectId ? `https://${projectId}.supabase.co` : "";
}

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function assertSupabaseConfig() {
  const url = supabaseUrl();
  const key = supabaseKey();

  if (!url || !key) {
    throw new AttendanceTimeTrackingError("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.", 503);
  }

  return { key, url };
}

async function requestSupabase<T>(path: string, init: RequestInit = {}) {
  const { key, url } = assertSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${url}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    const preview = (await response.text()).slice(0, 500);
    const tableMissing = preview.includes("attendance_sessions") || preview.includes("attendance_events");
    throw new AttendanceTimeTrackingError(
      tableMissing
        ? "Attendance time-tracking tables are not installed. Run docs/attendance-time-tracking-schema.sql in Supabase SQL Editor."
        : `Supabase attendance request failed with HTTP ${response.status}.`,
      tableMissing ? 503 : response.status,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function isAttendanceEventType(value: unknown): value is AttendanceEventType {
  return typeof value === "string" && attendanceEventTypes.includes(value as AttendanceEventType);
}

export function assertAttendanceEventType(value: unknown): AttendanceEventType {
  if (!isAttendanceEventType(value)) {
    throw new AttendanceTimeTrackingError("Invalid attendance event type.", 400);
  }

  return value;
}

function assertCoordinate(value: unknown, label: "lat" | "lng") {
  const numberValue = typeof value === "number" ? value : Number(value);
  const max = label === "lat" ? 90 : 180;

  if (!Number.isFinite(numberValue) || Math.abs(numberValue) > max) {
    throw new AttendanceTimeTrackingError(`Invalid ${label} coordinate.`, 400);
  }

  return numberValue;
}

export function assertLatitude(value: unknown) {
  return assertCoordinate(value, "lat");
}

export function assertLongitude(value: unknown) {
  return assertCoordinate(value, "lng");
}

function jakartaClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).formatToParts(now);

  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  const hour = Number(values.hour);
  const minute = Number(values.minute);
  const second = Number(values.second);

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    secondsSinceMidnight: hour * 3600 + minute * 60 + second,
  };
}

function firstClockInStatus() {
  const { secondsSinceMidnight } = jakartaClock();
  return secondsSinceMidnight <= 9 * 3600 + 59 ? "On Time" : "Late";
}

function todayDate() {
  return jakartaClock().date;
}

function jakartaTimeFromTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(timestamp));
}

function legacyStatusForSession(status: AttendanceSessionRecord["status"]): AttendanceStatus {
  if (status === "Late") return "Late";
  if (status === "Leave") return "Cuti";
  if (status === "System Auto-Closed") return "Absent";
  return "Present";
}

function approvalStatusForLegacyStatus(status: AttendanceStatus): Attendance["approval_status"] {
  return status === "Late" || status === "Absent" ? "Pending Approval" : "Not Required";
}

function terminalModeFor(session: AttendanceSessionRecord | null, events: AttendanceEventRecord[]): AttendanceTerminalMode {
  if (!session) return "none";
  if (session.status === "Leave" || session.status === "System Auto-Closed") return "closed";

  const lastEvent = events.at(-1) ?? null;
  if (!lastEvent) return "none";
  if (lastEvent.event_type === "clock_out") return "closed";
  if (lastEvent.event_type === "transit_pause") return "paused";
  return "working";
}

function calculateActiveMinutes(events: AttendanceEventRecord[]) {
  const sortedEvents = [...events].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  let activeStartedAt: number | null = null;
  let totalMs = 0;

  for (const event of sortedEvents) {
    const eventTime = new Date(event.timestamp).getTime();
    if (!Number.isFinite(eventTime)) continue;

    if (event.event_type === "clock_in") {
      activeStartedAt = eventTime;
      continue;
    }

    if (event.event_type === "transit_pause" && activeStartedAt !== null) {
      totalMs += Math.max(0, eventTime - activeStartedAt);
      activeStartedAt = null;
      continue;
    }

    if (event.event_type === "resume" && activeStartedAt === null) {
      activeStartedAt = eventTime;
      continue;
    }

    if (event.event_type === "clock_out") {
      if (activeStartedAt !== null) {
        totalMs += Math.max(0, eventTime - activeStartedAt);
      }
      break;
    }
  }

  return Math.max(0, Math.floor(totalMs / 60000));
}

async function readTodaySession(userId: string) {
  const params = new URLSearchParams({
    date: `eq.${todayDate()}`,
    limit: "1",
    order: "created_at.desc",
    select: "*",
    user_id: `eq.${userId}`,
  });

  const rows = await requestSupabase<AttendanceSessionRecord[]>(`/rest/v1/attendance_sessions?${params.toString()}`);
  return rows[0] ?? null;
}

async function readSessionEvents(sessionId: string) {
  const params = new URLSearchParams({
    order: "timestamp.asc",
    select: "*",
    session_id: `eq.${sessionId}`,
  });

  return requestSupabase<AttendanceEventRecord[]>(`/rest/v1/attendance_events?${params.toString()}`);
}

async function insertRow<T>(table: "attendance_sessions" | "attendance_events", record: Record<string, unknown>, options: SupabaseInsertOptions = {}) {
  const rows = await requestSupabase<T[]>(`/rest/v1/${table}`, {
    body: JSON.stringify(record),
    headers: { Prefer: options.prefer ?? "return=representation" },
    method: "POST",
  });

  return rows[0];
}

async function updateSession(sessionId: string, patch: Partial<AttendanceSessionRecord>) {
  const params = new URLSearchParams({ id: `eq.${sessionId}` });
  const rows = await requestSupabase<AttendanceSessionRecord[]>(`/rest/v1/attendance_sessions?${params.toString()}`, {
    body: JSON.stringify(patch),
    headers: { Prefer: "return=representation" },
    method: "PATCH",
  });

  return rows[0];
}

async function findLegacyAttendance(userId: string, date: string) {
  const records = await listResourceByField("Attendance", "user_id", userId);
  return records.find((record) => record.date === date);
}

async function syncLegacyAttendance({
  event,
  session,
}: {
  event: AttendanceEventRecord;
  session: AttendanceSessionRecord;
}) {
  const legacyStatus = legacyStatusForSession(session.status);
  const legacyRecord = await findLegacyAttendance(session.user_id, session.date);
  const eventTime = jakartaTimeFromTimestamp(event.timestamp);
  const activeMinutes = session.total_active_minutes;
  const sessionEvents = await readSessionEvents(session.id);
  const locationCount = sessionEvents.length;

  if (!legacyRecord) {
    const clockInEvent = sessionEvents.find((item) => item.event_type === "clock_in");

    const created = await createResource("Attendance", {
      approval_status: approvalStatusForLegacyStatus(legacyStatus),
      approved_by: "",
      active_minutes: activeMinutes,
      clock_in: clockInEvent ? jakartaTimeFromTimestamp(clockInEvent.timestamp) : "",
      clock_out: event.event_type === "clock_out" ? eventTime : "",
      date: session.date,
      location_count: locationCount,
      note: session.eod_summary ?? "",
      status: legacyStatus,
      user_id: session.user_id,
    });

    await awardPunctualAttendancePoints(created);
    return;
  }

  const updated = await updateResource("Attendance", legacyRecord.attendance_id, {
    active_minutes: activeMinutes,
    approval_status: approvalStatusForLegacyStatus(legacyStatus),
    clock_in: event.event_type === "clock_in" ? legacyRecord.clock_in || eventTime : legacyRecord.clock_in,
    clock_out: event.event_type === "clock_out" ? eventTime : legacyRecord.clock_out,
    location_count: locationCount,
    note: session.eod_summary ?? legacyRecord.note,
    status: legacyStatus,
  });

  if (updated) await awardPunctualAttendancePoints(updated);
}

function stateFor(session: AttendanceSessionRecord | null, events: AttendanceEventRecord[]): AttendanceTerminalState {
  const sortedEvents = [...events].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  return {
    activeMinutes: calculateActiveMinutes(sortedEvents),
    events: sortedEvents,
    lastEvent: sortedEvents.at(-1) ?? null,
    session,
    state: terminalModeFor(session, sortedEvents),
  };
}

export async function getTodayAttendanceTerminalState(userId: string): Promise<AttendanceTerminalState> {
  const session = await readTodaySession(userId);
  const events = session ? await readSessionEvents(session.id) : [];
  return stateFor(session, events);
}

function assertTransition(state: AttendanceTerminalState, eventType: AttendanceEventType) {
  if (state.state === "none" && eventType !== "clock_in") {
    throw new AttendanceTimeTrackingError("Clock in before sending another attendance event.", 409);
  }

  if (state.state === "working" && !["transit_pause", "clock_out"].includes(eventType)) {
    throw new AttendanceTimeTrackingError("The next available actions are pause or clock out.", 409);
  }

  if (state.state === "paused" && eventType !== "resume") {
    throw new AttendanceTimeTrackingError("Resume work before sending another attendance event.", 409);
  }

  if (state.state === "closed") {
    throw new AttendanceTimeTrackingError("Today attendance session is already closed.", 409);
  }
}

function normalizeEodSummary(eventType: AttendanceEventType, value: string | undefined) {
  if (eventType !== "clock_out") return undefined;

  const summary = (value ?? "").trim();
  if (summary.length < 20) {
    throw new AttendanceTimeTrackingError("End of Day Summary must be at least 20 characters.", 400);
  }

  return summary;
}

export async function logAttendanceEvent(input: LogAttendanceEventInput): Promise<AttendanceTerminalState> {
  const eventType = assertAttendanceEventType(input.eventType);
  const lat = assertLatitude(input.lat);
  const lng = assertLongitude(input.lng);
  const eodSummary = normalizeEodSummary(eventType, input.eodSummary);

  let state = await getTodayAttendanceTerminalState(input.userId);
  assertTransition(state, eventType);

  let session = state.session;

  if (!session) {
    session = await insertRow<AttendanceSessionRecord>("attendance_sessions", {
      date: todayDate(),
      status: firstClockInStatus(),
      total_active_minutes: 0,
      user_id: input.userId,
    });
  }

  const savedEvent = await insertRow<AttendanceEventRecord>("attendance_events", {
    event_type: eventType,
    lat,
    lng,
    session_id: session.id,
  });

  let events = await readSessionEvents(session.id);

  if (eventType === "clock_out") {
    const totalActiveMinutes = calculateActiveMinutes(events);
    const status = session.status === "Late" && totalActiveMinutes >= 540 ? "Present" : session.status;
    session = await updateSession(session.id, {
      eod_summary: eodSummary,
      status,
      total_active_minutes: totalActiveMinutes,
    });
    events = await readSessionEvents(session.id);
  }

  await syncLegacyAttendance({ event: savedEvent, session });

  state = stateFor(session, events);
  return state;
}
