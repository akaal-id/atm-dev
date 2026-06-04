import "server-only";

import { google } from "googleapis";

import { googleSheetsDatabaseSchema, type SheetName } from "@/lib/data/schema";

type SheetRecord = Record<string, unknown>;

const listFields = new Set(["assigned_to", "labels", "members", "target_users", "mentions", "links"]);
const jsonFields = new Set(["permissions_json", "criteria_json"]);
const booleanFields = new Set(["is_active", "is_completed", "assignee_completed", "pm_approved", "need_leader_approval", "is_pinned", "is_read"]);
const numberFields = new Set(["progress", "points"]);

function getPrivateKey() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function isGoogleSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

function getSheetsClient() {
  if (!isGoogleSheetsConfigured()) {
    throw new Error("Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  }

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

function parseCell(field: string, value: string | undefined) {
  if (value === undefined || value === "") return "";
  if (booleanFields.has(field)) return value === "TRUE" || value === "true";
  if (numberFields.has(field)) return Number(value);
  if (listFields.has(field)) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  if (jsonFields.has(field)) {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return value;
}

function serializeCell(value: unknown) {
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return value ?? "";
}

export async function readSheet(sheetName: SheetName): Promise<SheetRecord[]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values ?? [];
  if (rows.length < 2) return [];

  const headers = rows[0] as string[];

  return rows.slice(1).map((row) =>
    headers.reduce<SheetRecord>((record, field, index) => {
      record[field] = parseCell(field, String(row[index] ?? ""));
      return record;
    }, {}),
  );
}

export async function appendSheetRow(sheetName: SheetName, data: SheetRecord) {
  const sheets = getSheetsClient();
  const fields = googleSheetsDatabaseSchema[sheetName];
  const values = fields.map((field) => serializeCell(data[field]));

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

export async function updateSheetRow(sheetName: SheetName, idField: string, id: string, patch: SheetRecord) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values ?? [];
  const headers = rows[0] as string[] | undefined;
  if (!headers) throw new Error(`Sheet ${sheetName} is missing a header row.`);

  const idIndex = headers.indexOf(idField);
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[idIndex] === id);
  if (rowIndex === -1) throw new Error(`Could not find ${idField}=${id} in ${sheetName}.`);

  const current = rows[rowIndex] ?? [];
  const next = headers.map((field, index) => serializeCell(patch[field] ?? current[index] ?? ""));

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [next] },
  });
}

export async function ensureSheetHeaders() {
  if (!isGoogleSheetsConfigured()) return { configured: false, sheets: Object.keys(googleSheetsDatabaseSchema) };

  const sheets = getSheetsClient();

  await Promise.all(
    Object.entries(googleSheetsDatabaseSchema).map(async ([sheetName, fields]) => {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
        range: `${sheetName}!A1:Z1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [Array.from(fields)] },
      });
    }),
  );

  return { configured: true, sheets: Object.keys(googleSheetsDatabaseSchema) };
}
