import "server-only";

import type { SheetName } from "@/lib/data/schema";

type SheetRecord = Record<string, unknown>;

export class AppsScriptResponseError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly preview?: string,
  ) {
    super(message);
    this.name = "AppsScriptResponseError";
  }
}

function getEndpoint() {
  return process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL;
}

function getSecret() {
  return process.env.GOOGLE_APPS_SCRIPT_SECRET;
}

export function isAppsScriptConfigured() {
  return Boolean(getEndpoint() && getSecret());
}

async function requestAppsScript<T>(payload: Record<string, unknown>): Promise<T> {
  const endpoint = getEndpoint();
  const secret = getSecret();

  if (!endpoint || !secret) {
    throw new Error("Apps Script is not configured. Set GOOGLE_APPS_SCRIPT_WEB_APP_URL and GOOGLE_APPS_SCRIPT_SECRET.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      secret,
      ...payload,
    }),
    cache: "no-store",
  });

  const text = await response.text();
  let data: ({ ok?: boolean; error?: string } & T) | undefined;

  try {
    data = JSON.parse(text) as { ok?: boolean; error?: string } & T;
  } catch {
    const preview = text.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new AppsScriptResponseError(
      "Apps Script returned HTML instead of JSON. Check that GOOGLE_APPS_SCRIPT_WEB_APP_URL is the Web app /exec URL and deployment access is set to Anyone.",
      response.status,
      preview,
    );
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? `Apps Script request failed with status ${response.status}.`);
  }

  return data;
}

export async function readAppsScriptSheet(sheetName: SheetName): Promise<SheetRecord[]> {
  const data = await requestAppsScript<{ rows: SheetRecord[] }>({
    action: "read",
    sheetName,
  });

  return data.rows ?? [];
}

export async function appendAppsScriptRow(sheetName: SheetName, data: SheetRecord) {
  await requestAppsScript({
    action: "append",
    sheetName,
    data,
  });
}

export async function updateAppsScriptRow(sheetName: SheetName, idField: string, id: string, patch: SheetRecord) {
  await requestAppsScript({
    action: "update",
    sheetName,
    idField,
    id,
    data: patch,
  });
}

export async function deleteAppsScriptRow(sheetName: SheetName, idField: string, id: string) {
  await requestAppsScript({
    action: "delete",
    sheetName,
    idField,
    id,
  });
}

export async function ensureAppsScriptHeaders() {
  return requestAppsScript<{ sheets: string[] }>({
    action: "ensureHeaders",
  });
}

export async function testAppsScriptConnection() {
  const data = await requestAppsScript<{ rows: SheetRecord[] }>({
    action: "read",
    sheetName: "Users",
  });

  return {
    ok: true,
    mode: "apps_script",
    usersRows: data.rows?.length ?? 0,
  };
}
