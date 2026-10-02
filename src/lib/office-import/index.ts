import type { OfficeFileType } from "@/lib/types/office";

/** File extensions the Office importer accepts, grouped by the Univer editor that opens them. */
export const importExtensions: Record<OfficeFileType, string[]> = {
  sheet: ["xlsx", "xlsm", "xls", "csv", "tsv", "ods"],
  doc: ["docx"],
};
export const importAccept = Object.values(importExtensions)
  .flat()
  .map((extension) => `.${extension}`)
  .join(",");

export type ImportedFile = {
  type: OfficeFileType;
  title: string;
  /** Univer data ready to store. */
  snapshot: Record<string, unknown>;
  warnings: string[];
};

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export function importTypeFor(fileName: string): OfficeFileType | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (Object.entries(importExtensions).find(([, list]) => list.includes(extension))?.[0] as OfficeFileType | undefined) ?? null;
}

/** Convert an uploaded .docx / .xlsx / .xls / .csv / .ods in the browser. Converters load lazily. */
export async function importOfficeFile(file: File): Promise<ImportedFile> {
  const type = importTypeFor(file.name);
  if (!type) throw new Error("Unsupported file. Use .docx, .xlsx, .xls, .csv, or .ods (old .doc: save as .docx first).");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("File is larger than 25 MB.");
  const title = file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Imported file";

  if (type === "sheet") {
    const { importSpreadsheet } = await import("@/lib/office-import/spreadsheet");
    return { type, title, snapshot: (await importSpreadsheet(file)) as unknown as Record<string, unknown>, warnings: [] };
  }
  const { importDocx } = await import("@/lib/office-import/document");
  const { snapshot, warnings } = await importDocx(file, title);
  return { type, title, snapshot: snapshot as unknown as Record<string, unknown>, warnings };
}
