import type { OfficeFileType } from "@/lib/types/office";

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Shape check for stored Univer data, per file type (the editors own the details). */
export function isValidSnapshot(type: OfficeFileType, snapshot: unknown): snapshot is Record<string, unknown> {
  if (!isObject(snapshot)) return false;
  if (type === "doc") return snapshot.version === 2 && Array.isArray(snapshot.tabs) && snapshot.tabs.length > 0;
  return true;
}
