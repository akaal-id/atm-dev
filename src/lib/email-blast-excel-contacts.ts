import type { NewContactInput } from "@/components/app/email-blast/email-blast-add-contact-form";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function cellText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return String(value).trim();
}

function isNameHeader(header: string) {
  return header === "nama" || header === "name" || header === "fullname";
}

function isEmailHeader(header: string) {
  return header === "email" || header === "emailaddress" || header === "mail" || header === "alamatemail";
}

function isCompanyHeader(header: string) {
  return header === "company" || header === "perusahaan" || header === "companyname";
}

export type ParseContactExcelResult = {
  contacts: NewContactInput[];
  skipped: number;
  invalidEmails: string[];
};

/** Parse Excel/CSV rows: row 1 = nama | email headers, following rows = contacts. */
export function parseContactSheetRows(rows: unknown[][]): ParseContactExcelResult {
  if (!rows.length) {
    throw new Error("File kosong. Pastikan ada header nama | email di baris pertama.");
  }

  const headerRow = rows[0] || [];
  const headers = headerRow.map(normalizeHeader);
  const nameIndex = headers.findIndex(isNameHeader);
  const emailIndex = headers.findIndex(isEmailHeader);
  const companyIndex = headers.findIndex(isCompanyHeader);

  if (emailIndex < 0) {
    throw new Error('Header "email" tidak ditemukan di baris pertama. Format: nama | email');
  }
  if (nameIndex < 0) {
    throw new Error('Header "nama" tidak ditemukan di baris pertama. Format: nama | email');
  }

  const contacts: NewContactInput[] = [];
  const seen = new Set<string>();
  const invalidEmails: string[] = [];
  let skipped = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const email = cellText(row[emailIndex]).toLowerCase();
    const fullName = cellText(row[nameIndex]);
    const company = companyIndex >= 0 ? cellText(row[companyIndex]) : "";

    if (!email && !fullName) {
      skipped += 1;
      continue;
    }

    if (!email || !EMAIL_PATTERN.test(email)) {
      if (email) invalidEmails.push(email);
      else skipped += 1;
      continue;
    }

    if (seen.has(email)) {
      skipped += 1;
      continue;
    }

    seen.add(email);
    contacts.push({ email, fullName, company });
  }

  if (contacts.length === 0) {
    throw new Error(
      invalidEmails.length > 0
        ? `Tidak ada kontak valid. Email tidak valid: ${invalidEmails.slice(0, 5).join(", ")}`
        : "Tidak ada baris kontak di bawah header.",
    );
  }

  return { contacts, skipped, invalidEmails };
}

/** Read .xlsx / .xls / .csv file into contact rows using SheetJS. */
export async function parseContactsFromExcelFile(file: File): Promise<ParseContactExcelResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook tidak memiliki sheet.");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  return parseContactSheetRows(rows);
}
