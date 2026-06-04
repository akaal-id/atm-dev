import "server-only";

import type { Permission } from "@/lib/types";
import type { ResourceName } from "@/lib/server/store";
import { taskNeedsLeaderApproval } from "@/lib/task-approval";

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [trimmed];
    } catch {
      return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function ensurePermissions(value: unknown): Permission[] {
  const items = ensureStringArray(value);
  return items as Permission[];
}

function normalizeDateField(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function ensureBoolean(value: unknown) {
  return value === true || value === "true" || value === "TRUE" || value === 1 || value === "1";
}

function ensureNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeSupabaseRecord(resource: ResourceName, row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...row };

  if (resource === "Users") {
    normalized.birthday = normalizeDateField(row.birthday);
    normalized.join_date = normalizeDateField(row.join_date);
    normalized.is_active = ensureBoolean(row.is_active);
    normalized.signup_status = String(row.signup_status ?? "");
  }

  if (resource === "Roles") {
    normalized.permissions_json = ensurePermissions(row.permissions_json);
  }

  if (resource === "Tasks") {
    normalized.assigned_to = ensureStringArray(row.assigned_to);
    normalized.labels = ensureStringArray(row.labels);
    normalized.need_leader_approval = taskNeedsLeaderApproval({
      labels: normalized.labels as string[],
      need_leader_approval: row.need_leader_approval as boolean | string | number | undefined,
    });
    normalized.progress = ensureNumber(row.progress);
  }

  if (resource === "Projects") {
    normalized.members = ensureStringArray(row.members);
    normalized.links = ensureStringArray(row.links);
    normalized.progress = ensureNumber(row.progress);
  }

  if (resource === "Announcements") {
    normalized.target_users = ensureStringArray(row.target_users);
    normalized.is_pinned = ensureBoolean(row.is_pinned);
  }

  if (resource === "Task_Comments") {
    normalized.mentions = ensureStringArray(row.mentions);
  }

  if (resource === "Notifications") {
    normalized.is_read = ensureBoolean(row.is_read);
  }

  if (resource === "Task_Checklists") {
    normalized.is_completed = ensureBoolean(row.is_completed);
    normalized.assignee_completed = row.assignee_completed === undefined ? ensureBoolean(row.is_completed) : ensureBoolean(row.assignee_completed);
    normalized.assignee_completed_by = String(row.assignee_completed_by ?? "");
    normalized.pm_approved = ensureBoolean(row.pm_approved);
    normalized.pm_approved_by = String(row.pm_approved_by ?? "");
  }

  return normalized;
}

export function normalizeSupabaseRecords(resource: ResourceName, rows: Record<string, unknown>[]) {
  return rows.map((row) => normalizeSupabaseRecord(resource, row));
}
