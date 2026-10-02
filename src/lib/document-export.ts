/**
 * Client-side export of rich-text (tiptap HTML) to DOCX and PDF, and of Univer
 * workbook snapshots to XLSX. Libraries are imported lazily on first export.
 */

export type DocRun = { text: string; bold?: boolean; italic?: boolean };
export type DocBlock = {
  kind: "title" | "heading" | "subheading" | "paragraph" | "bullet" | "number" | "quote" | "meta";
  runs: DocRun[];
  /** 1-based position for numbered list items. */
  index?: number;
};

function inlineRuns(node: Node, style: { bold?: boolean; italic?: boolean } = {}): DocRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text ? [{ text, ...style }] : [];
  }
  if (!(node instanceof HTMLElement)) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return [{ text: "\n", ...style }];
  const next = {
    bold: style.bold || tag === "strong" || tag === "b",
    italic: style.italic || tag === "em" || tag === "i",
  };
  const runs = [...node.childNodes].flatMap((child) => inlineRuns(child, next));
  // Keep link targets visible in exported files.
  if (tag === "a") {
    const href = node.getAttribute("href");
    const label = node.textContent ?? "";
    if (href && href !== label) runs.push({ text: ` (${href})`, ...style });
  }
  return runs;
}

function blocksFromElement(element: Element, out: DocBlock[]) {
  for (const child of [...element.children]) {
    const tag = child.tagName.toLowerCase();
    if (tag === "h1") out.push({ kind: "heading", runs: inlineRuns(child) });
    else if (tag === "h2") out.push({ kind: "heading", runs: inlineRuns(child) });
    else if (tag === "h3" || tag === "h4") out.push({ kind: "subheading", runs: inlineRuns(child) });
    else if (tag === "ul" || tag === "ol") {
      let index = 0;
      for (const item of [...child.children]) {
        if (item.tagName.toLowerCase() !== "li") continue;
        index += 1;
        // A list item holds paragraphs and possibly nested lists; flatten them.
        const nested: DocBlock[] = [];
        const text: DocRun[] = [];
        for (const part of [...item.childNodes]) {
          if (part instanceof HTMLElement && (part.tagName === "UL" || part.tagName === "OL")) {
            const holder = document.createElement("div");
            holder.appendChild(part.cloneNode(true));
            blocksFromElement(holder, nested);
          } else {
            text.push(...inlineRuns(part));
          }
        }
        out.push({ kind: tag === "ol" ? "number" : "bullet", runs: text, index });
        out.push(...nested);
      }
    } else if (tag === "blockquote") {
      const inner: DocBlock[] = [];
      blocksFromElement(child, inner);
      out.push(...inner.map((block) => ({ ...block, kind: "quote" as const })));
      if (inner.length === 0) out.push({ kind: "quote", runs: inlineRuns(child) });
    } else if (tag === "p" || tag === "pre" || tag === "div") {
      if (tag === "div" && child.children.length > 0 && [...child.children].some((c) => /^(P|UL|OL|H\d|BLOCKQUOTE)$/.test(c.tagName))) {
        blocksFromElement(child, out);
      } else {
        out.push({ kind: "paragraph", runs: inlineRuns(child) });
      }
    } else {
      out.push({ kind: "paragraph", runs: inlineRuns(child) });
    }
  }
}

/** Parse tiptap/chat HTML into flat blocks. Plain text becomes paragraphs. */
export function htmlToBlocks(html: string): DocBlock[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return [];
  const blocks: DocBlock[] = [];
  if (root.children.length === 0 && root.textContent?.trim()) {
    blocks.push({ kind: "paragraph", runs: [{ text: root.textContent }] });
  } else {
    blocksFromElement(root, blocks);
  }
  return blocks;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 120) || "document";
}

export async function downloadDocx(title: string, blocks: DocBlock[]) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");

  const runsFor = (block: DocBlock, extra: { italics?: boolean; size?: number; color?: string } = {}) =>
    block.runs.flatMap((run) =>
      run.text.split("\n").map(
        (line, lineIndex) =>
          new TextRun({ text: line, bold: run.bold, italics: run.italic || extra.italics, size: extra.size, color: extra.color, break: lineIndex > 0 ? 1 : undefined }),
      ),
    );

  const paragraphs = blocks.map((block) => {
    switch (block.kind) {
      case "title":
        return new Paragraph({ heading: HeadingLevel.TITLE, children: runsFor(block) });
      case "heading":
        return new Paragraph({ heading: HeadingLevel.HEADING_1, children: runsFor(block) });
      case "subheading":
        return new Paragraph({ heading: HeadingLevel.HEADING_2, children: runsFor(block) });
      case "bullet":
        return new Paragraph({ bullet: { level: 0 }, children: runsFor(block) });
      case "number":
        return new Paragraph({ children: [new TextRun({ text: `${block.index ?? 1}. ` }), ...runsFor(block)], indent: { left: 360 } });
      case "quote":
        return new Paragraph({ children: runsFor(block, { italics: true }), indent: { left: 360 } });
      case "meta":
        return new Paragraph({ children: runsFor(block, { size: 18, color: "6B7280" }), spacing: { before: 240 } });
      default:
        return new Paragraph({ children: runsFor(block), spacing: { after: 120 } });
    }
  });

  const document = new Document({ creator: "ATM", title, sections: [{ children: paragraphs }] });
  downloadBlob(await Packer.toBlob(document), `${safeFilename(title)}.docx`);
}

/** jsPDF's built-in fonts only cover Latin-1; drop emoji and other symbols they can't draw. */
function pdfSafe(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/[^\n -ÿ]/g, "");
}

export async function downloadPdf(title: string, blocks: DocBlock[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;

  const styleFor: Record<DocBlock["kind"], { size: number; style: "normal" | "bold" | "italic"; gapBefore: number; color: number }> = {
    title: { size: 20, style: "bold", gapBefore: 0, color: 17 },
    heading: { size: 15, style: "bold", gapBefore: 14, color: 17 },
    subheading: { size: 12.5, style: "bold", gapBefore: 10, color: 17 },
    paragraph: { size: 11, style: "normal", gapBefore: 6, color: 17 },
    bullet: { size: 11, style: "normal", gapBefore: 3, color: 17 },
    number: { size: 11, style: "normal", gapBefore: 3, color: 17 },
    quote: { size: 11, style: "italic", gapBefore: 6, color: 90 },
    meta: { size: 9, style: "normal", gapBefore: 16, color: 110 },
  };

  for (const block of blocks) {
    const spec = styleFor[block.kind];
    const prefix = block.kind === "bullet" ? "-  " : block.kind === "number" ? `${block.index ?? 1}.  ` : "";
    const indent = prefix || block.kind === "quote" ? 16 : 0;
    const text = pdfSafe(block.runs.map((run) => run.text).join(""));
    if (!text.trim()) {
      y += spec.size * 0.6;
      continue;
    }
    pdf.setFont("helvetica", spec.style);
    pdf.setFontSize(spec.size);
    pdf.setTextColor(spec.color);
    const lines = pdf.splitTextToSize(prefix + text, width - indent) as string[];
    const lineHeight = spec.size * 1.4;
    y += spec.gapBefore;
    for (const line of lines) {
      if (y + lineHeight > bottom) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin + indent, y + spec.size);
      y += lineHeight;
    }
  }

  pdf.save(`${safeFilename(title)}.pdf`);
}

type SheetCell = { v?: string | number | boolean | null; f?: string | null };
type WorkbookSnapshot = {
  sheetOrder?: string[];
  sheets?: Record<string, { name?: string; cellData?: Record<string, Record<string, SheetCell>> }>;
};

/** Export a Univer workbook snapshot (values + formulas) to .xlsx with SheetJS. */
export async function downloadXlsx(title: string, snapshot: WorkbookSnapshot | null) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const sheets = snapshot?.sheets ?? {};
  const order = snapshot?.sheetOrder?.length ? snapshot.sheetOrder : Object.keys(sheets);

  for (const sheetId of order) {
    const sheet = sheets[sheetId];
    if (!sheet) continue;
    const worksheet: Record<string, unknown> = {};
    let maxRow = 0;
    let maxCol = 0;
    for (const [rowKey, row] of Object.entries(sheet.cellData ?? {})) {
      for (const [colKey, cell] of Object.entries(row ?? {})) {
        const r = Number(rowKey);
        const c = Number(colKey);
        if (!cell || (cell.v === undefined && !cell.f)) continue;
        const value = cell.v ?? "";
        const xlsxCell: Record<string, unknown> =
          typeof value === "number" ? { t: "n", v: value } : typeof value === "boolean" ? { t: "b", v: value } : { t: "s", v: String(value) };
        if (cell.f) xlsxCell.f = cell.f.replace(/^=/, "");
        worksheet[XLSX.utils.encode_cell({ r, c })] = xlsxCell;
        maxRow = Math.max(maxRow, r);
        maxCol = Math.max(maxCol, c);
      }
    }
    worksheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
    const name = (sheet.name || `Sheet${book.SheetNames.length + 1}`).replace(/[\\/?*[\]:]/g, "").slice(0, 31);
    XLSX.utils.book_append_sheet(book, worksheet as never, name || `Sheet${book.SheetNames.length + 1}`);
  }
  if (book.SheetNames.length === 0) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[]]), "Sheet1");
  XLSX.writeFile(book, `${safeFilename(title)}.xlsx`);
}
