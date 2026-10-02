/**
 * Spreadsheet import → Univer workbook data (IWorkbookData).
 * .xlsx via exceljs (values, formulas, fonts, fills, borders, alignment, number
 * formats, merges, sizes, freeze panes); .xls / .csv / .ods via SheetJS (values,
 * formulas, merges, column widths). Univer's own importer is a paid Pro feature.
 */

type Style = Record<string, unknown>;
type Cell = { v?: string | number | boolean | null; f?: string; s?: Style; t?: number };
type Range = { startRow: number; endRow: number; startColumn: number; endColumn: number };
type SheetData = {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  cellData: Record<number, Record<number, Cell>>;
  mergeData: Range[];
  rowData: Record<number, { h?: number; hd?: number }>;
  columnData: Record<number, { w?: number; hd?: number }>;
  freeze?: { xSplit: number; ySplit: number; startRow: number; startColumn: number };
  tabColor?: string;
};
export type WorkbookData = { id: string; name: string; appVersion: string; styles: Record<string, Style>; sheetOrder: string[]; sheets: Record<string, SheetData> };

const randomId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;
const CELL_TYPE = { STRING: 1, NUMBER: 2, BOOLEAN: 3 } as const;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function emptySheet(name: string): SheetData {
  return { id: randomId("sheet_"), name: name.slice(0, 31) || "Sheet1", rowCount: 1000, columnCount: 26, cellData: {}, mergeData: [], rowData: {}, columnData: {} };
}

function finishSheet(sheet: SheetData) {
  const rows = Object.keys(sheet.cellData).map(Number);
  const cols = rows.flatMap((row) => Object.keys(sheet.cellData[row]).map(Number));
  sheet.rowCount = Math.max(1000, (rows.length ? Math.max(...rows) : 0) + 100);
  sheet.columnCount = Math.max(26, (cols.length ? Math.max(...cols) : 0) + 10);
  return sheet;
}

function workbook(name: string, sheets: SheetData[]): WorkbookData {
  const list = sheets.length ? sheets : [emptySheet("Sheet1")];
  return {
    id: randomId("wb_"),
    name,
    appVersion: "",
    styles: {},
    sheetOrder: list.map((sheet) => sheet.id),
    sheets: Object.fromEntries(list.map((sheet) => [sheet.id, finishSheet(sheet)])),
  };
}

function setCell(sheet: SheetData, row: number, col: number, cell: Cell) {
  (sheet.cellData[row] ??= {})[col] = cell;
}

// ── exceljs (.xlsx) ──────────────────────────────────────────────────────────

/** "FFRRGGBB" / "RRGGBB" → "#RRGGBB" (theme/indexed colours are skipped). */
function argb(color?: { argb?: string }) {
  const value = color?.argb;
  if (!value || !/^[0-9a-f]{6,8}$/i.test(value)) return undefined;
  return `#${value.slice(-6)}`;
}

const borderStyles: Record<string, number> = {
  thin: 1, hair: 2, dotted: 3, dashed: 4, dashDot: 5, dashDotDot: 6, double: 7, medium: 8,
  mediumDashed: 9, mediumDashDot: 10, mediumDashDotDot: 11, slantDashDot: 12, thick: 13,
};
const horizontal: Record<string, number> = { left: 1, center: 2, centerContinuous: 2, right: 3, justify: 4, distributed: 6 };
const vertical: Record<string, number> = { top: 1, middle: 2, bottom: 3 };

type ExcelCell = {
  value: unknown;
  formula?: string;
  result?: unknown;
  numFmt?: string;
  font?: { name?: string; size?: number; bold?: boolean; italic?: boolean; underline?: unknown; strike?: boolean; color?: { argb?: string } };
  fill?: { type?: string; pattern?: string; fgColor?: { argb?: string } };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  border?: Partial<Record<"top" | "right" | "bottom" | "left", { style?: string; color?: { argb?: string } }>>;
  isMerged?: boolean;
  master?: { address: string };
  address: string;
};

function excelStyle(cell: ExcelCell): Style | undefined {
  const style: Style = {};
  const font = cell.font;
  if (font?.name) style.ff = font.name;
  if (font?.size) style.fs = font.size;
  if (font?.bold) style.bl = 1;
  if (font?.italic) style.it = 1;
  if (font?.underline) style.ul = { s: 1 };
  if (font?.strike) style.st = { s: 1 };
  if (argb(font?.color)) style.cl = { rgb: argb(font?.color) };
  if (cell.fill?.type === "pattern" && cell.fill.pattern === "solid" && argb(cell.fill.fgColor)) style.bg = { rgb: argb(cell.fill.fgColor) };
  const align = cell.alignment;
  if (align?.horizontal && horizontal[align.horizontal]) style.ht = horizontal[align.horizontal];
  if (align?.vertical && vertical[align.vertical]) style.vt = vertical[align.vertical];
  if (align?.wrapText) style.tb = 3; // WrapStrategy.WRAP
  const border: Style = {};
  for (const [side, key] of [["top", "t"], ["right", "r"], ["bottom", "b"], ["left", "l"]] as const) {
    const edge = cell.border?.[side];
    if (edge?.style && borderStyles[edge.style]) border[key] = { s: borderStyles[edge.style], cl: { rgb: argb(edge.color) ?? "#000000" } };
  }
  if (Object.keys(border).length) style.bd = border;
  if (cell.numFmt && cell.numFmt !== "General") style.n = { pattern: cell.numFmt };
  return Object.keys(style).length ? style : undefined;
}

/** Plain value of an exceljs cell value (rich text, hyperlinks, dates, formula results, errors). */
function excelValue(value: unknown): { v: Cell["v"]; date?: boolean } {
  if (value === null || value === undefined) return { v: null };
  if (value instanceof Date) return { v: (value.getTime() - EXCEL_EPOCH) / 86_400_000, date: true };
  if (typeof value !== "object") return { v: value as Cell["v"] };
  const object = value as Record<string, unknown>;
  if (Array.isArray(object.richText)) return { v: (object.richText as Array<{ text: string }>).map((part) => part.text).join("") };
  if ("text" in object && "hyperlink" in object) return excelValue(object.text);
  if ("result" in object) return excelValue(object.result);
  if ("error" in object) return { v: String(object.error) };
  return { v: String(value) };
}

async function importXlsx(buffer: ArrayBuffer, name: string): Promise<WorkbookData> {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const { decode } = await cellAddressing();

  const sheets = book.worksheets.map((worksheet) => {
    const sheet = emptySheet(worksheet.name);
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (row.height) sheet.rowData[rowNumber - 1] = { h: Math.round((row.height * 96) / 72) };
      if (row.hidden) sheet.rowData[rowNumber - 1] = { ...sheet.rowData[rowNumber - 1], hd: 1 };
      row.eachCell({ includeEmpty: false }, (raw, colNumber) => {
        const cell = raw as unknown as ExcelCell;
        if (cell.isMerged && cell.master && cell.master.address !== cell.address) return; // merged children carry no data
        const { v, date } = excelValue(cell.value);
        const out: Cell = {};
        const formula = cell.formula;
        if (formula) out.f = `=${formula}`;
        if (v !== null && v !== undefined && v !== "") {
          out.v = v;
          out.t = typeof v === "number" ? CELL_TYPE.NUMBER : typeof v === "boolean" ? CELL_TYPE.BOOLEAN : CELL_TYPE.STRING;
        }
        const style = excelStyle(cell) ?? {};
        if (date && !style.n) style.n = { pattern: "yyyy-mm-dd" };
        if (Object.keys(style).length) out.s = style;
        if (Object.keys(out).length) setCell(sheet, rowNumber - 1, colNumber - 1, out);
      });
    });

    (worksheet.columns ?? []).forEach((column, index) => {
      if (column?.width) sheet.columnData[index] = { w: Math.round(column.width * 7 + 5) };
      if (column?.hidden) sheet.columnData[index] = { ...sheet.columnData[index], hd: 1 };
    });

    const merges = (worksheet.model as { merges?: string[] }).merges ?? [];
    sheet.mergeData = merges.map((range) => {
      const [start, end = start] = range.split(":");
      const a = decode(start);
      const b = decode(end);
      return { startRow: a.r, endRow: b.r, startColumn: a.c, endColumn: b.c };
    });

    const view = worksheet.views?.[0] as { state?: string; xSplit?: number; ySplit?: number } | undefined;
    if (view?.state === "frozen" && (view.xSplit || view.ySplit)) {
      sheet.freeze = { xSplit: view.xSplit ?? 0, ySplit: view.ySplit ?? 0, startRow: view.ySplit ?? 0, startColumn: view.xSplit ?? 0 };
    }
    const tab = argb((worksheet.properties as { tabColor?: { argb?: string } }).tabColor);
    if (tab) sheet.tabColor = tab;
    return sheet;
  });

  return workbook(name, sheets);
}

// ── SheetJS (.xls, .csv, .ods) ───────────────────────────────────────────────

async function cellAddressing() {
  const XLSX = await import("xlsx");
  return { decode: (address: string) => XLSX.utils.decode_cell(address.replace(/\$/g, "")), XLSX };
}

async function importWithSheetJs(buffer: ArrayBuffer, name: string, csv: boolean): Promise<WorkbookData> {
  const XLSX = await import("xlsx");
  const book = csv
    ? XLSX.read(new TextDecoder().decode(buffer), { type: "string", raw: false, cellDates: false })
    : XLSX.read(new Uint8Array(buffer), { type: "array", cellFormula: true, cellNF: true });

  const sheets = book.SheetNames.map((sheetName) => {
    const source = book.Sheets[sheetName];
    const sheet = emptySheet(sheetName);
    for (const [address, raw] of Object.entries(source)) {
      if (address.startsWith("!")) continue;
      const cell = raw as { v?: unknown; t?: string; f?: string; z?: string };
      const { r, c } = XLSX.utils.decode_cell(address);
      const out: Cell = {};
      if (cell.f) out.f = `=${cell.f}`;
      if (cell.v !== undefined && cell.v !== null && cell.t !== "e") {
        out.v = cell.v as Cell["v"];
        out.t = cell.t === "n" ? CELL_TYPE.NUMBER : cell.t === "b" ? CELL_TYPE.BOOLEAN : CELL_TYPE.STRING;
      }
      if (cell.z && cell.z !== "General" && typeof cell.v === "number") out.s = { n: { pattern: String(cell.z) } };
      if (Object.keys(out).length) setCell(sheet, r, c, out);
    }
    sheet.mergeData = ((source["!merges"] ?? []) as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>).map((merge) => ({
      startRow: merge.s.r,
      endRow: merge.e.r,
      startColumn: merge.s.c,
      endColumn: merge.e.c,
    }));
    ((source["!cols"] ?? []) as Array<{ wpx?: number; wch?: number; hidden?: boolean } | undefined>).forEach((column, index) => {
      const width = column?.wpx ?? (column?.wch ? column.wch * 7 + 5 : undefined);
      if (width) sheet.columnData[index] = { w: Math.round(width) };
      if (column?.hidden) sheet.columnData[index] = { ...sheet.columnData[index], hd: 1 };
    });
    return sheet;
  });

  return workbook(name, sheets);
}

export async function importSpreadsheet(file: File): Promise<WorkbookData> {
  const name = file.name.replace(/\.[^.]+$/, "");
  const buffer = await file.arrayBuffer();
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx" || extension === "xlsm") return importXlsx(buffer, name);
  return importWithSheetJs(buffer, name, extension === "csv" || extension === "tsv");
}
