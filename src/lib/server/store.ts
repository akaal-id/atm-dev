import "server-only";

import { seedResources } from "@/lib/data/seed";
import { googleSheetsDatabaseSchema, type SheetName } from "@/lib/data/schema";
import { appendAppsScriptRow, deleteAppsScriptRow, isAppsScriptConfigured, readAppsScriptSheet, updateAppsScriptRow } from "@/lib/server/apps-script";
import { appendSheetRow, isGoogleSheetsConfigured, readSheet, updateSheetRow } from "@/lib/server/google-sheets";
import { sendNotificationEmail } from "@/lib/server/resend";
import { normalizeSupabaseRecords } from "@/lib/server/normalize-records";
import {
  deleteSupabaseResource,
  insertSupabaseResource,
  isSupabaseConfigured,
  readSupabaseResource,
  readSupabaseResourceWhere,
  updateSupabaseResource,
} from "@/lib/server/supabase-store";
import type { AppNotification, User } from "@/lib/types";
import { makeId } from "@/lib/utils";

export type ResourceName = keyof typeof seedResources;
export type ResourceItem<R extends ResourceName> = (typeof seedResources)[R][number];

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

const idPrefixes: Record<ResourceName, string> = {
  Users: "usr",
  Departments: "dept",
  Roles: "role",
  Tasks: "tsk",
  Task_Comments: "cmt",
  Task_Checklists: "chk",
  Projects: "prj",
  Attendance: "att",
  Leave_Requests: "req",
  Announcements: "ann",
  Calendar_Events: "evt",
  Notifications: "ntf",
  Gamification_Points: "pts",
  Badges: "bdg",
  User_Badges: "ubg",
  Activity_Logs: "log",
  Settings: "set",
};

type Store = { [K in ResourceName]: ResourceItem<K>[] };

const globalStore = globalThis as typeof globalThis & { __atmStore?: Store };

function createStore(): Store {
  return Object.fromEntries(
    Object.entries(seedResources).map(([resource, records]) => [resource, structuredClone(records)]),
  ) as Store;
}

const store = (globalStore.__atmStore ??= createStore());

function blankSheetRecord(resource: ResourceName) {
  return Object.fromEntries(googleSheetsDatabaseSchema[resource].map((field) => [field, ""]));
}

function shouldUseSheets() {
  return isGoogleSheetsConfigured() && process.env.ATM_DATA_MODE === "sheets";
}

function shouldUseAppsScript() {
  return isAppsScriptConfigured() && process.env.ATM_DATA_MODE === "apps_script";
}

function shouldUseSupabase() {
  return isSupabaseConfigured() && process.env.ATM_DATA_MODE === "supabase";
}

export const resourceNames = Object.keys(seedResources) as ResourceName[];

export function getResourceIdField(resource: ResourceName) {
  return idFields[resource];
}

export async function listResource<R extends ResourceName>(resource: R): Promise<ResourceItem<R>[]> {
  if (shouldUseSupabase()) {
    const rows = await readSupabaseResource(resource);
    return normalizeSupabaseRecords(resource, rows) as unknown as ResourceItem<R>[];
  }

  if (shouldUseAppsScript()) {
    const rows = await readAppsScriptSheet(resource as SheetName);
    return rows as unknown as ResourceItem<R>[];
  }

  if (shouldUseSheets()) {
    const rows = await readSheet(resource as SheetName);
    return rows as unknown as ResourceItem<R>[];
  }

  return store[resource] as ResourceItem<R>[];
}

export async function listResourceByField<R extends ResourceName>(
  resource: R,
  field: string,
  value: string | number | boolean,
  options: { limit?: number; orderBy?: string; ascending?: boolean } = {},
): Promise<ResourceItem<R>[]> {
  if (shouldUseSupabase()) {
    const rows = await readSupabaseResourceWhere(resource, {
      filters: { [field]: value },
      limit: options.limit,
      orderBy: options.orderBy,
      ascending: options.ascending,
    });
    return normalizeSupabaseRecords(resource, rows) as unknown as ResourceItem<R>[];
  }

  let rows = (await listResource(resource)).filter((item) => {
    const record = item as unknown as Record<string, unknown>;
    return String(record[field] ?? "") === String(value);
  });

  if (options.orderBy) {
    rows = [...rows].sort((left, right) => {
      const leftValue = String((left as unknown as Record<string, unknown>)[options.orderBy!] ?? "");
      const rightValue = String((right as unknown as Record<string, unknown>)[options.orderBy!] ?? "");
      return options.ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
    });
  }

  return typeof options.limit === "number" ? rows.slice(0, options.limit) : rows;
}

export async function getResourceById<R extends ResourceName>(resource: R, id: string): Promise<ResourceItem<R> | undefined> {
  const idField = idFields[resource];
  const items = await listResource(resource);
  return items.find((item) => String(item[idField as keyof ResourceItem<R>]) === id);
}

export async function createResource<R extends ResourceName>(resource: R, payload: Partial<ResourceItem<R>>) {
  const now = new Date().toISOString();
  const idField = idFields[resource] as keyof ResourceItem<R>;
  const record = {
    ...payload,
    [idField]: payload[idField] ?? makeId(idPrefixes[resource]),
    created_at: (payload as Record<string, unknown>).created_at ?? now,
    updated_at: now,
  } as unknown as ResourceItem<R>;

  if (shouldUseSupabase()) {
    const created = (await insertSupabaseResource(resource, record as unknown as Record<string, unknown>)) as unknown as ResourceItem<R>;
    if (resource === "Notifications") {
      await sendEmailForNotification(created as unknown as AppNotification);
    }
    return created;
  }

  store[resource].unshift(record as never);

  if (shouldUseSheets()) {
    await appendSheetRow(resource as SheetName, record as unknown as Record<string, unknown>);
  }

  if (shouldUseAppsScript()) {
    await appendAppsScriptRow(resource as SheetName, record as unknown as Record<string, unknown>);
  }

  if (resource === "Notifications") {
    await sendEmailForNotification(record as unknown as AppNotification);
  }

  return record;
}

async function sendEmailForNotification(notification: AppNotification) {
  try {
    const [user] = (await listResourceByField("Users", "user_id", notification.user_id, { limit: 1 })) as User[];
    const result = await sendNotificationEmail(notification, user);

    if (!result.ok) {
      console.error("Resend notification email failed", result.error);
    }
  } catch (error) {
    console.error("Resend notification email failed", error);
  }
}

export async function updateResource<R extends ResourceName>(resource: R, id: string, patch: Partial<ResourceItem<R>>) {
  const idField = idFields[resource];
  const updatedAt = new Date().toISOString();

  if (shouldUseSupabase()) {
    return (await updateSupabaseResource(resource, idField, id, {
      ...(patch as Record<string, unknown>),
      updated_at: updatedAt,
    })) as unknown as ResourceItem<R> | undefined;
  }

  const sourceRecords = shouldUseAppsScript() || shouldUseSheets()
    ? ((await listResource(resource)) as unknown as Array<Record<string, unknown>>)
    : (store[resource] as unknown as Array<Record<string, unknown>>);
  const index = sourceRecords.findIndex((item) => item[idField] === id);
  if (index === -1) return undefined;

  const next = { ...sourceRecords[index], ...patch, updated_at: updatedAt };

  if (!shouldUseAppsScript() && !shouldUseSheets()) {
    sourceRecords[index] = next;
  }

  if (shouldUseSheets()) {
    await updateSheetRow(resource as SheetName, idField, id, next);
  }

  if (shouldUseAppsScript()) {
    await updateAppsScriptRow(resource as SheetName, idField, id, next);
  }

  return next as unknown as ResourceItem<R>;
}

export async function deleteResourcesByField<R extends ResourceName>(resource: R, field: string, value: string) {
  const matches = await listResourceByField(resource, field, value);
  const results = await Promise.all(
    matches.map((item) => {
      const idField = idFields[resource];
      const recordId = String((item as unknown as Record<string, unknown>)[idField] ?? "");
      return recordId ? deleteResource(resource, recordId) : Promise.resolve(false);
    }),
  );
  return results.filter(Boolean).length;
}

export async function deleteResource(resource: ResourceName, id: string) {
  const idField = idFields[resource];
  const records = shouldUseAppsScript() || shouldUseSheets()
    ? ((await listResource(resource)) as unknown as Array<Record<string, unknown>>)
    : (store[resource] as unknown as Array<Record<string, unknown>>);
  const index = records.findIndex((item) => item[idField] === id);
  if (index === -1) return false;

  if (resource === "Users") {
    await updateResource("Users", id, {
      is_active: false,
      employment_status: "Inactive",
      signup_status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: "Removed by admin",
    } as Partial<ResourceItem<"Users">>);
    return true;
  }

  if (shouldUseSupabase()) {
    return deleteSupabaseResource(resource, idField, id);
  }

  if (shouldUseAppsScript()) {
    try {
      await deleteAppsScriptRow(resource as SheetName, idField, id);
    } catch (error) {
      console.error(`Apps Script delete failed for ${resource}; blanking row instead.`, error);
      await updateAppsScriptRow(resource as SheetName, idField, id, blankSheetRecord(resource));
    }
    return true;
  }

  if (shouldUseSheets()) {
    await updateSheetRow(resource as SheetName, idField, id, blankSheetRecord(resource));
    return true;
  }

  records.splice(index, 1);
  return true;
}
