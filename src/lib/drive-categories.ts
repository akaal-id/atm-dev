/**
 * Drive layout for ATM uploads (shared by client + server):
 *   <GOOGLE_DRIVE_FOLDER_ID = "Main Akaal 2026"> / <Category> / <Project name> / <Subfolder> / DDMMYY_<file or folder>
 */
export const DRIVE_CATEGORIES = [
  { value: "client", label: "Client", folder: "Client" },
  { value: "company", label: "Company", folder: "Company" },
  { value: "event", label: "Event", folder: "Event" },
  { value: "internal_brand", label: "Internal Brand", folder: "Internal Brand" },
] as const;

export type DriveCategory = (typeof DRIVE_CATEGORIES)[number]["value"];

export function isDriveCategory(value: unknown): value is DriveCategory {
  return DRIVE_CATEGORIES.some((category) => category.value === value);
}

export function driveCategoryLabel(value: string | null | undefined) {
  return DRIVE_CATEGORIES.find((category) => category.value === value)?.label ?? "";
}

/** "071026_" for 7 Oct 2026 (Jakarta time) — prefix for every uploaded file or folder. */
export function driveDatePrefix(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("day")}${part("month")}${part("year")}_`;
}

/** Drive allows almost anything, but keep folder names tidy and single-line. */
export function cleanDriveName(value: string) {
  return value.replace(/[\r\n\t/\\]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}
