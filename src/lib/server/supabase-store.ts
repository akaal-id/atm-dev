import "server-only";

import { appDatabaseSchema } from "@/lib/data/schema";

export type SupabaseResourceName = keyof typeof appDatabaseSchema;

export const supabaseTables: Record<SupabaseResourceName, string> = {
  Users: "users",
  Departments: "departments",
  Roles: "roles",
  Tasks: "tasks",
  Task_Comments: "task_comments",
  Task_Checklists: "task_checklists",
  Projects: "projects",
  Attendance: "attendance",
  Leave_Requests: "leave_requests",
  Announcements: "announcements",
  Calendar_Events: "calendar_events",
  Notifications: "notifications",
  Gamification_Points: "gamification_points",
  Badges: "badges",
  User_Badges: "user_badges",
  Activity_Logs: "activity_logs",
  Settings: "settings",
};

class SupabaseStoreError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly preview?: string,
  ) {
    super(message);
    this.name = "SupabaseStoreError";
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

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseKey());
}

function assertSupabaseConfig() {
  const url = supabaseUrl();
  const key = supabaseKey();

  if (!url || !key) {
    throw new SupabaseStoreError("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  return { url, key };
}

async function requestSupabase<T>(path: string, init: RequestInit = {}) {
  const { url, key } = assertSupabaseConfig();
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
    const preview = await response.text();
    throw new SupabaseStoreError(`Supabase request failed for ${path}`, response.status, preview.slice(0, 500));
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function tableFor(resource: SupabaseResourceName) {
  return supabaseTables[resource];
}

function filterById(idField: string, id: string) {
  return `${encodeURIComponent(idField)}=eq.${encodeURIComponent(id)}`;
}

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return { configured: false, mode: "supabase", tables: supabaseTables };
  }

  const rows = await requestSupabase<unknown[]>("/rest/v1/roles?select=role_id&limit=1");
  return {
    configured: true,
    mode: "supabase",
    reachable: true,
    sampledRows: rows.length,
    tables: supabaseTables,
  };
}

export async function readSupabaseResource(resource: SupabaseResourceName) {
  const table = tableFor(resource);
  return requestSupabase<Record<string, unknown>[]>(
    `/rest/v1/${table}?select=*&order=created_at.desc.nullslast`,
  );
}

export async function insertSupabaseResource(resource: SupabaseResourceName, record: Record<string, unknown>) {
  const table = tableFor(resource);
  const rows = await requestSupabase<Record<string, unknown>[]>(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(record),
  });

  return rows[0];
}

export async function upsertSupabaseResources(resource: SupabaseResourceName, idField: string, records: Array<Record<string, unknown>>) {
  if (records.length === 0) return 0;

  const table = tableFor(resource);
  const batchSize = 250;
  let total = 0;

  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    await requestSupabase<undefined>(`/rest/v1/${table}?on_conflict=${encodeURIComponent(idField)}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(batch),
    });
    total += batch.length;
  }

  return total;
}

export async function updateSupabaseResource(resource: SupabaseResourceName, idField: string, id: string, patch: Record<string, unknown>) {
  const table = tableFor(resource);
  const rows = await requestSupabase<Record<string, unknown>[]>(`/rest/v1/${table}?${filterById(idField, id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });

  return rows[0];
}

export async function deleteSupabaseResource(resource: SupabaseResourceName, idField: string, id: string) {
  const table = tableFor(resource);
  const rows = await requestSupabase<Record<string, unknown>[]>(`/rest/v1/${table}?${filterById(idField, id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });

  return rows.length > 0;
}
