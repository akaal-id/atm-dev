/* eslint-disable */

const ATM_SECRET = "atm_9f4c2a7b8e1d44a19c6f2b0d5a83e7c1";

const SCHEMA = {
  Users: [
    "user_id",
    "full_name",
    "email",
    "password_hash_or_auth_id",
    "profile_photo",
    "bio",
    "phone",
    "department_id",
    "position",
    "employment_status",
    "role_id",
    "birthday",
    "join_date",
    "is_active",
    "signup_status",
    "signup_provider",
    "verification_key_hash",
    "verification_expires_at",
    "requested_at",
    "approved_at",
    "rejected_at",
    "rejection_reason",
    "created_at",
    "updated_at",
  ],
  Departments: ["department_id", "department_name", "leader_user_id", "created_at", "updated_at"],
  Roles: ["role_id", "role_name", "permissions_json", "created_at", "updated_at"],
  Tasks: [
    "task_id",
    "title",
    "description",
    "project_id",
    "assigned_by",
    "assigned_to",
    "priority",
    "status",
    "due_date",
    "progress",
    "labels",
    "created_at",
    "updated_at",
    "completed_at",
  ],
  Task_Comments: ["comment_id", "task_id", "user_id", "comment", "mentions", "created_at", "updated_at"],
  Task_Checklists: ["checklist_id", "task_id", "title", "is_completed", "created_at", "updated_at"],
  Projects: [
    "project_id",
    "project_name",
    "description",
    "owner_user_id",
    "members",
    "priority",
    "status",
    "progress",
    "deadline",
    "created_at",
    "updated_at",
  ],
  Attendance: [
    "attendance_id",
    "user_id",
    "date",
    "clock_in",
    "clock_out",
    "status",
    "note",
    "approval_status",
    "approved_by",
    "created_at",
    "updated_at",
  ],
  Leave_Requests: [
    "request_id",
    "user_id",
    "request_type",
    "start_date",
    "end_date",
    "reason",
    "attachment_url",
    "status",
    "approved_by",
    "approval_note",
    "created_at",
    "updated_at",
  ],
  Announcements: [
    "announcement_id",
    "title",
    "body",
    "category",
    "target_department",
    "target_users",
    "is_pinned",
    "scheduled_at",
    "created_by",
    "created_at",
    "updated_at",
  ],
  Calendar_Events: [
    "event_id",
    "title",
    "description",
    "type",
    "start_date",
    "end_date",
    "related_user_id",
    "related_task_id",
    "related_project_id",
    "created_by",
    "created_at",
    "updated_at",
  ],
  Notifications: ["notification_id", "user_id", "title", "description", "type", "related_link", "is_read", "created_at"],
  Gamification_Points: ["point_id", "user_id", "source_type", "source_id", "points", "reason", "created_at"],
  Badges: ["badge_id", "badge_name", "description", "icon", "criteria_json", "created_at", "updated_at"],
  User_Badges: ["user_badge_id", "user_id", "badge_id", "earned_at"],
  Activity_Logs: ["log_id", "user_id", "action", "entity_type", "entity_id", "description", "created_at"],
  Settings: ["setting_id", "setting_key", "setting_value", "setting_type", "updated_by", "updated_at"],
};

const LIST_FIELDS = new Set(["assigned_to", "labels", "members", "target_users", "mentions", "links"]);
const JSON_FIELDS = new Set(["permissions_json", "criteria_json"]);
const BOOLEAN_FIELDS = new Set(["is_active", "is_completed", "is_pinned", "is_read"]);
const NUMBER_FIELDS = new Set(["progress", "points"]);

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || "{}");

    if (payload.secret !== ATM_SECRET) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (payload.action === "read") {
      return json({ ok: true, rows: readSheet(payload.sheetName) });
    }

    if (payload.action === "append") {
      appendRow(payload.sheetName, payload.data || {});
      return json({ ok: true });
    }

    if (payload.action === "update") {
      updateRow(payload.sheetName, payload.idField, payload.id, payload.data || {});
      return json({ ok: true });
    }

    if (payload.action === "delete") {
      deleteRow(payload.sheetName, payload.idField, payload.id);
      return json({ ok: true });
    }

    if (payload.action === "ensureHeaders") {
      ensureHeaders();
      return json({ ok: true, sheets: Object.keys(SCHEMA) });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    return json({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
  }
}

function readSheet(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  return values
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) =>
      headers.reduce((record, field, index) => {
        record[field] = parseCell(field, row[index]);
        return record;
      }, {}),
    );
}

function appendRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);
  sheet.appendRow(headers.map((field) => serializeCell(data[field])));
}

function updateRow(sheetName, idField, id, data) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idIndex = headers.indexOf(idField);

  if (idIndex === -1) throw new Error(`Missing id field ${idField} in ${sheetName}`);

  const rowIndex = values.findIndex((row, index) => index > 0 && String(row[idIndex]) === String(id));
  if (rowIndex === -1) throw new Error(`Could not find ${idField}=${id} in ${sheetName}`);

  const current = values[rowIndex];
  const next = headers.map((field, index) => serializeCell(Object.prototype.hasOwnProperty.call(data, field) ? data[field] : current[index]));
  sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([next]);
}

function deleteRow(sheetName, idField, id) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idIndex = headers.indexOf(idField);

  if (idIndex === -1) throw new Error(`Missing id field ${idField} in ${sheetName}`);

  const rowIndex = values.findIndex((row, index) => index > 0 && String(row[idIndex]) === String(id));
  if (rowIndex === -1) throw new Error(`Could not find ${idField}=${id} in ${sheetName}`);

  sheet.deleteRow(rowIndex + 1);
}

function ensureHeaders() {
  Object.keys(SCHEMA).forEach((sheetName) => {
    const sheet = getSheet(sheetName, true);
    const headers = SCHEMA[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  });
}

function getSheet(sheetName, createIfMissing) {
  if (!SCHEMA[sheetName]) throw new Error(`Unknown sheet ${sheetName}`);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet) return sheet;
  if (createIfMissing) return spreadsheet.insertSheet(sheetName);
  throw new Error(`Missing sheet tab ${sheetName}`);
}

function getHeaders(sheetName) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  return headers.filter(Boolean);
}

function parseCell(field, value) {
  if (value === "" || value === null || value === undefined) return "";
  if (BOOLEAN_FIELDS.has(field)) return value === true || value === "TRUE" || value === "true";
  if (NUMBER_FIELDS.has(field)) return Number(value);

  if (LIST_FIELDS.has(field)) {
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (JSON_FIELDS.has(field)) {
    try {
      return JSON.parse(String(value));
    } catch (error) {
      return {};
    }
  }

  return value instanceof Date ? value.toISOString() : String(value);
}

function serializeCell(value) {
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return value === undefined || value === null ? "" : value;
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
