/**
 * Spreadsheet → PDF (Univer's print/export is a paid Pro feature). Each visible,
 * non-empty sheet's used range becomes an HTML table — values formatted with
 * Univer's own `numfmt`, plus fonts, colours, fills, borders, alignment, wrapping,
 * merges, and column widths / row heights — rendered with html2canvas and paged
 * into jsPDF at row boundaries. Wide sheets switch to landscape and shrink to fit
 * the page width. Browser only; libraries load on first use.
 */

import { downloadBlob, safeFilename } from "@/lib/document-export";

type Color = { rgb?: string | null } | null | undefined;
type Edge = { s?: number; cl?: Color } | null | undefined;
type Style = {
  ff?: string | null;
  fs?: number;
  bl?: number;
  it?: number;
  ul?: { s?: number };
  st?: { s?: number };
  cl?: Color;
  bg?: Color;
  ht?: number | null;
  vt?: number | null;
  tb?: number | null;
  bd?: { t?: Edge; r?: Edge; b?: Edge; l?: Edge } | null;
  n?: { pattern?: string } | null;
};
type Cell = { v?: unknown; s?: Style | string | null; p?: { body?: { dataStream?: string } } | null; t?: number | null };
export type Sheet = {
  name?: string;
  hidden?: number;
  cellData?: Record<string, Record<string, Cell>>;
  mergeData?: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }>;
  rowData?: Record<string, { h?: number; hd?: number }>;
  columnData?: Record<string, { w?: number; hd?: number }>;
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
};
export type WorkbookSnapshot = { styles?: Record<string, Style | null>; sheetOrder?: string[]; sheets?: Record<string, Sheet> };

const PX_TO_PT = 0.75;
const A4 = { width: 595.28, height: 841.89 }; // pt, portrait
const MARGIN_PT = 28; // ≈ 1 cm
const DEFAULT_COLUMN_WIDTH = 88;
const DEFAULT_ROW_HEIGHT = 24;
const GRIDLINE = "#e5e7eb";

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const borderCss: Record<number, string> = {
  1: "1px solid", 2: "1px solid", 3: "1px dotted", 4: "1px dashed", 5: "1px dashed", 6: "1px dashed",
  7: "3px double", 8: "2px solid", 9: "2px dashed", 10: "2px dashed", 11: "2px dashed", 12: "2px dashed", 13: "3px solid",
};

function resolveStyle(raw: Cell["s"], styles: WorkbookSnapshot["styles"]): Style {
  if (!raw) return {};
  return typeof raw === "string" ? styles?.[raw] ?? {} : raw;
}

export type Formatter = (pattern: string, value: unknown) => string;

/** Displayed text of a cell: rich text, formatted number, boolean, or plain value. */
function displayValue(cell: Cell, style: Style, format: Formatter) {
  const rich = cell.p?.body?.dataStream;
  if (rich) return rich.replace(/\r\n$/, "").replace(/\r/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f]/g, "");
  const value = cell.v;
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    try {
      return format(style.n?.pattern || "General", value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function cellCss(style: Style, isNumber: boolean) {
  const css: string[] = [];
  if (style.ff) css.push(`font-family:'${style.ff.replace(/'/g, "")}',Arial,sans-serif`);
  if (style.fs) css.push(`font-size:${style.fs}pt`);
  if (style.bl === 1) css.push("font-weight:700");
  if (style.it === 1) css.push("font-style:italic");
  const decoration = [style.ul?.s === 1 ? "underline" : "", style.st?.s === 1 ? "line-through" : ""].filter(Boolean).join(" ");
  if (decoration) css.push(`text-decoration:${decoration}`);
  if (style.cl?.rgb) css.push(`color:${style.cl.rgb}`);
  if (style.bg?.rgb) css.push(`background:${style.bg.rgb}`);
  const align = style.ht === 2 ? "center" : style.ht === 3 ? "right" : style.ht === 4 ? "justify" : style.ht === 1 ? "left" : isNumber ? "right" : "left";
  css.push(`text-align:${align}`);
  css.push(`vertical-align:${style.vt === 1 ? "top" : style.vt === 2 ? "middle" : "bottom"}`);
  css.push(style.tb === 3 ? "white-space:pre-wrap;overflow-wrap:anywhere" : "white-space:pre;overflow:hidden;text-overflow:clip");
  for (const [side, key] of [["top", "t"], ["right", "r"], ["bottom", "b"], ["left", "l"]] as const) {
    const edge = style.bd?.[key];
    if (edge?.s) css.push(`border-${side}:${borderCss[edge.s] ?? "1px solid"} ${edge.cl?.rgb ?? "#000"}`);
  }
  return css.join(";");
}

function usedRange(sheet: Sheet, styles: WorkbookSnapshot["styles"]) {
  let maxRow = -1;
  let maxCol = -1;
  for (const [rowKey, row] of Object.entries(sheet.cellData ?? {})) {
    for (const [colKey, cell] of Object.entries(row ?? {})) {
      const style = resolveStyle(cell?.s, styles);
      const hasValue = cell?.v !== undefined && cell?.v !== null && cell?.v !== "";
      if (hasValue || cell?.p || style.bg?.rgb || style.bd) {
        maxRow = Math.max(maxRow, Number(rowKey));
        maxCol = Math.max(maxCol, Number(colKey));
      }
    }
  }
  for (const merge of sheet.mergeData ?? []) {
    if (maxRow >= 0) {
      maxRow = Math.max(maxRow, merge.endRow);
      maxCol = Math.max(maxCol, merge.endColumn);
    }
  }
  return maxRow < 0 ? null : { rows: maxRow + 1, cols: maxCol + 1 };
}

/** HTML table for a sheet's used range, plus its pixel width (exported for tests). */
export function sheetTable(sheet: Sheet, styles: WorkbookSnapshot["styles"], format: Formatter) {
  const range = usedRange(sheet, styles);
  if (!range) return null;
  const columnWidth = (col: number) => sheet.columnData?.[col]?.w ?? sheet.defaultColumnWidth ?? DEFAULT_COLUMN_WIDTH;
  const rowHeight = (row: number) => sheet.rowData?.[row]?.h ?? sheet.defaultRowHeight ?? DEFAULT_ROW_HEIGHT;
  const visibleCols = Array.from({ length: range.cols }, (_, col) => col).filter((col) => sheet.columnData?.[col]?.hd !== 1);
  const visibleRows = Array.from({ length: range.rows }, (_, row) => row).filter((row) => sheet.rowData?.[row]?.hd !== 1);

  // Merge anchors span; covered cells are skipped.
  const anchors = new Map<string, { rowSpan: number; colSpan: number }>();
  const covered = new Set<string>();
  for (const merge of sheet.mergeData ?? []) {
    const rows = visibleRows.filter((row) => row >= merge.startRow && row <= merge.endRow);
    const cols = visibleCols.filter((col) => col >= merge.startColumn && col <= merge.endColumn);
    if (!rows.length || !cols.length) continue;
    anchors.set(`${rows[0]}:${cols[0]}`, { rowSpan: rows.length, colSpan: cols.length });
    for (const row of rows) for (const col of cols) if (row !== rows[0] || col !== cols[0]) covered.add(`${row}:${col}`);
  }

  const width = visibleCols.reduce((sum, col) => sum + columnWidth(col), 0);
  const colgroup = visibleCols.map((col) => `<col style="width:${columnWidth(col)}px">`).join("");
  const body = visibleRows
    .map((row) => {
      const cells = visibleCols
        .map((col) => {
          const key = `${row}:${col}`;
          if (covered.has(key)) return "";
          const cell = sheet.cellData?.[row]?.[col] ?? {};
          const style = resolveStyle(cell.s, styles);
          const span = anchors.get(key);
          const spanAttrs = span ? ` rowspan="${span.rowSpan}" colspan="${span.colSpan}"` : "";
          const text = displayValue(cell, style, format);
          return `<td${spanAttrs} style="${cellCss(style, typeof cell.v === "number")}">${escapeHtml(text)}</td>`;
        })
        .join("");
      return `<tr style="height:${rowHeight(row)}px">${cells}</tr>`;
    })
    .join("");

  const table = `<table style="border-collapse:collapse;table-layout:fixed;width:${width}px;font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111"><colgroup>${colgroup}</colgroup><tbody>${body}</tbody></table>`;
  return { html: table, width };
}

/** Slice points at row boundaries so no row is cut across pages. */
function rowCuts(host: HTMLElement, pageHeight: number) {
  const top = host.getBoundingClientRect().top;
  const ends = [...host.querySelectorAll("tr, [data-heading]")].map((row) => row.getBoundingClientRect().bottom - top);
  const total = host.scrollHeight;
  const cuts: Array<[number, number]> = [];
  let start = 0;
  while (start < total - 1) {
    let end = Math.min(start + pageHeight, total);
    if (end < total) {
      const best = Math.max(0, ...ends.filter((value) => value <= end && value > start));
      if (best > start + pageHeight * 0.2) end = best; // else a single row taller than a page: hard cut
    }
    cuts.push([start, end]);
    start = end;
  }
  return cuts;
}

export async function downloadSheetPdf(title: string, snapshot: WorkbookSnapshot | null) {
  const [{ jsPDF }, { default: html2canvas }, { numfmt }] = await Promise.all([import("jspdf"), import("html2canvas"), import("@univerjs/core")]);
  const format: Formatter = (pattern, value) => numfmt.format(pattern, value);
  const sheets = snapshot?.sheets ?? {};
  const order = snapshot?.sheetOrder?.length ? snapshot.sheetOrder : Object.keys(sheets);
  const tables = order
    .map((id) => sheets[id])
    .filter((sheet): sheet is Sheet => Boolean(sheet) && sheet.hidden !== 1)
    .map((sheet) => ({ name: sheet.name ?? "Sheet", table: sheetTable(sheet, snapshot?.styles, format) }))
    .filter((entry): entry is { name: string; table: NonNullable<ReturnType<typeof sheetTable>> } => entry.table !== null);

  if (tables.length === 0) throw new Error("The spreadsheet is empty — nothing to export.");

  let pdf: InstanceType<typeof jsPDF> | null = null;
  const SCALE = 2;

  for (const { name, table } of tables) {
    // Landscape when the table doesn't fit a portrait page at full size.
    const portraitWidthPx = (A4.width - MARGIN_PT * 2) / PX_TO_PT;
    const landscape = table.width > portraitWidthPx;
    const page = landscape ? { width: A4.height, height: A4.width } : A4;
    const contentWidthPt = page.width - MARGIN_PT * 2;
    const contentHeightPt = page.height - MARGIN_PT * 2;
    const fit = Math.min(1, contentWidthPt / (table.width * PX_TO_PT)); // shrink wide sheets to page width
    const pageHeightPx = contentHeightPt / (PX_TO_PT * fit);

    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-100000px;top:0;width:${table.width}px;background:#fff`;
    const heading = tables.length > 1 ? `<div data-heading style="font:600 11pt Arial,sans-serif;color:#374151;padding:0 0 6px">${escapeHtml(name)}</div>` : "";
    host.innerHTML = `${heading}${table.html}`;
    // Light gridlines on cells without their own border, like a spreadsheet print with gridlines on.
    host.querySelectorAll("td").forEach((td) => {
      for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
        if (!td.style[`border${side}`]) td.style[`border${side}`] = `1px solid ${GRIDLINE}`;
      }
      td.style.padding = "2px 4px";
    });
    document.body.appendChild(host);
    try {
      const canvas = await html2canvas(host, { scale: SCALE, backgroundColor: "#ffffff", logging: false });
      for (const [start, end] of rowCuts(host, pageHeightPx)) {
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.max(1, Math.round((end - start) * SCALE));
        slice.getContext("2d")!.drawImage(canvas, 0, Math.round(start * SCALE), canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        const format: [number, number] = [page.width, page.height];
        const orientation = landscape ? "landscape" : "portrait";
        if (!pdf) pdf = new jsPDF({ unit: "pt", format, orientation });
        else pdf.addPage(format, orientation);
        pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_PT, MARGIN_PT, table.width * PX_TO_PT * fit, (end - start) * PX_TO_PT * fit);
      }
    } finally {
      host.remove();
    }
  }

  const finished = pdf as InstanceType<typeof jsPDF> | null;
  if (finished) downloadBlob(finished.output("blob"), `${safeFilename(title)}.pdf`);
}
