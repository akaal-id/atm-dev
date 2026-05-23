import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/auth";
import type { ResourceName } from "@/lib/server/store";
import { resourceNames } from "@/lib/server/store";
import { uploadFormFile } from "@/lib/server/uploads";
import type { Permission } from "@/lib/types";

const readPermissions: Partial<Record<ResourceName, Permission[]>> = {
  Users: ["employees:view", "employees:manage"],
  Departments: ["employees:view", "settings:manage"],
  Roles: ["roles:manage", "admin:view"],
  Tasks: ["tasks:own", "tasks:team", "tasks:manage"],
  Task_Comments: ["tasks:own", "tasks:team", "tasks:manage"],
  Task_Checklists: ["tasks:own", "tasks:team", "tasks:manage"],
  Projects: ["projects:manage", "tasks:team"],
  Attendance: ["attendance:own", "attendance:team"],
  Leave_Requests: ["attendance:own", "attendance:approve"],
  Announcements: ["announcements:view"],
  Calendar_Events: ["dashboard:view"],
  Notifications: ["notifications:view"],
  Gamification_Points: ["leaderboard:view"],
  Badges: ["leaderboard:view", "settings:manage"],
  User_Badges: ["leaderboard:view"],
  Activity_Logs: ["admin:view"],
  Settings: ["settings:manage"],
};

const writePermissions: Partial<Record<ResourceName, Permission[]>> = {
  Users: ["employees:manage"],
  Departments: ["settings:manage"],
  Roles: ["roles:manage"],
  Tasks: ["tasks:own", "tasks:team", "tasks:manage"],
  Task_Comments: ["tasks:own", "tasks:team", "tasks:manage"],
  Task_Checklists: ["tasks:manage"],
  Projects: ["projects:manage"],
  Attendance: ["attendance:own", "attendance:team"],
  Leave_Requests: ["attendance:own", "attendance:approve"],
  Announcements: ["announcements:manage"],
  Calendar_Events: ["settings:manage", "announcements:manage"],
  Notifications: ["notifications:view", "admin:view"],
  Gamification_Points: ["settings:manage"],
  Badges: ["settings:manage"],
  User_Badges: ["settings:manage"],
  Activity_Logs: ["admin:view"],
  Settings: ["settings:manage"],
};

export function parseResource(value: string): ResourceName | null {
  return resourceNames.includes(value as ResourceName) ? (value as ResourceName) : null;
}

export async function requireApiAccess(resource: ResourceName, mode: "read" | "write") {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const permissions = mode === "read" ? readPermissions[resource] : writePermissions[resource];
  if (permissions && !hasAnyPermission(user.role_id, permissions)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function requireApiPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasPermission(user.role_id, permission)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

function coerceField(key: string, value: FormDataEntryValue) {
  if (typeof File !== "undefined" && value instanceof File) return "";

  const text = String(value);
  if (["is_active", "is_completed", "is_pinned", "is_read"].includes(key)) return text === "on" || text === "true" || text === "TRUE";
  if (["progress", "points"].includes(key)) return Number(text);
  if (["assigned_to", "labels", "members", "target_users", "mentions", "links"].includes(key)) {
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return text;
}

function isNonEmptyFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function isEmptyFile(value: FormDataEntryValue) {
  return typeof File !== "undefined" && value instanceof File && value.size === 0;
}

function targetFieldForUpload(key: string) {
  if (key === "profile_photo_file") return "profile_photo";
  if (key === "attachment_file" || key === "attachment_url_file") return "attachment_url";
  return key.endsWith("_file") ? key.slice(0, -5) : key;
}

export async function readPayload(request: Request | NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  const formData = await request.formData();
  const payload: Record<string, unknown> = {};

  for (const key of Array.from(new Set(Array.from(formData.keys())))) {
    const values = formData.getAll(key);
    const files = values.filter(isNonEmptyFile);

    if (files.length > 0) {
      const uploadUrls = await Promise.all(files.map((file) => uploadFormFile(file, key)));
      payload[targetFieldForUpload(key)] = uploadUrls.length === 1 ? uploadUrls[0] : uploadUrls;
      continue;
    }

    if (values.every(isEmptyFile)) continue;

    if (values.length > 1) {
      payload[key] = values.map((value) => coerceField(key, value)).filter(Boolean);
      continue;
    }

    const value = values[0];
    if (value === undefined) continue;

    const nextValue = coerceField(key, value);
    const targetKey = targetFieldForUpload(key);
    if (nextValue === "" && typeof payload[targetKey] === "string" && payload[targetKey]) {
      continue;
    }

    payload[key] = nextValue;
  }

  return payload;
}

export function normalizePayload(payload: Record<string, unknown>) {
  const next = { ...payload };

  for (const key of ["assigned_to", "labels", "members", "target_users", "mentions", "links"]) {
    const value = next[key];
    if (typeof value === "string") {
      next[key] = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  for (const key of ["progress", "points"]) {
    const value = next[key];
    if (typeof value === "string" && value !== "") {
      next[key] = Number(value);
    }
  }

  return next;
}

export function withAuditDefaults(payload: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    ...payload,
    created_at: payload.created_at || now,
    updated_at: now,
  };
}

export function getRecordId(record: Record<string, unknown>, resource: ResourceName) {
  const idFields: Record<ResourceName, string> = {
    Users: "user_id",
    Departments: "department_id",
    Roles: "role_id",
    Tasks: "task_id",
    Task_Comments: "comment_id",
    Task_Checklists: "checklist_id",
    Projects: "project_id",
    Attendance: "attendance_id",
    Leave_Requests: "request_id",
    Announcements: "announcement_id",
    Calendar_Events: "event_id",
    Notifications: "notification_id",
    Gamification_Points: "point_id",
    Badges: "badge_id",
    User_Badges: "user_badge_id",
    Activity_Logs: "log_id",
    Settings: "setting_id",
  };

  return String(record[idFields[resource]] ?? "");
}

export function cleanEmptyStrings(payload: Record<string, unknown>) {
  return Object.entries(payload).reduce<Record<string, unknown>>((cleaned, [key, value]) => {
    if (value !== "") cleaned[key] = value;
    return cleaned;
  }, {});
}

export function redirectBack(request: NextRequest, fallback = "/dashboard") {
  const referer = request.headers.get("referer");
  return NextResponse.redirect(referer || new URL(fallback, request.url));
}

export function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json") || request.headers.get("content-type")?.includes("application/json");
}
