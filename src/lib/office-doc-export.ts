/**
 * Export tabbed Univer documents to DOCX (docx) and PDF (html2canvas + jsPDF).
 * Browser only; libraries load on first use. Univer's own exchange/print plugins
 * are paid Pro features, so we convert from the document model ourselves.
 */

import { downloadBlob, safeFilename } from "@/lib/document-export";
import { documentToBlocks, pageMetrics, printableData, type DocTab, type DocTextStyle, type ExportBlock, type ExportParagraph, type ExportRun } from "@/lib/office-doc";

const PX_TO_TWIP = 15; // 1440 twips per inch / 96 px per inch
const PX_TO_PT = 0.75;

function hexColor(value?: string | null) {
  if (!value) return undefined;
  const hex = value.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i)?.[1];
  if (hex) return (hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex).toUpperCase();
  const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) return rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  return undefined;
}

async function imageBytes(src: string): Promise<{ data: Uint8Array; type: "png" | "jpg" | "gif" | "bmp" } | null> {
  try {
    const blob = await (await fetch(src)).blob();
    const mime = blob.type || (src.startsWith("data:") ? src.slice(5, src.indexOf(";")) : "");
    const type = mime.includes("png") ? "png" : mime.includes("gif") ? "gif" : mime.includes("bmp") ? "bmp" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : null;
    if (!type) return null; // docx can't embed svg/webp without a fallback
    return { data: new Uint8Array(await blob.arrayBuffer()), type };
  } catch {
    return null; // cross-origin images without CORS can't be read
  }
}

// ── DOCX ─────────────────────────────────────────────────────────────────────

export async function downloadDocumentDocx(title: string, tabs: DocTab[]) {
  const docx = await import("docx");
  const { AlignmentType, Document, ExternalHyperlink, HeadingLevel, ImageRun, LevelFormat, Packer, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } = docx;
  type Child = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;

  const headings = {
    title: HeadingLevel.TITLE,
    subtitle: HeadingLevel.HEADING_2,
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
  } as const;
  const alignments = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const;

  const textRun = (text: string, style: DocTextStyle) =>
    new TextRun({
      text,
      bold: style.bl === 1,
      italics: style.it === 1,
      underline: style.ul?.s === 1 ? {} : undefined,
      strike: style.st?.s === 1,
      color: hexColor(style.cl?.rgb),
      shading: hexColor(style.bg?.rgb) ? { type: ShadingType.CLEAR, color: "auto", fill: hexColor(style.bg?.rgb)! } : undefined,
      font: style.ff ?? undefined,
      size: style.fs ? Math.round(style.fs * 2) : undefined,
      superScript: style.va === 3,
      subScript: style.va === 2,
    });

  const runsFor = async (runs: ExportRun[]) => {
    const out = [];
    for (const run of runs) {
      if (run.kind === "image") {
        const image = await imageBytes(run.src);
        if (image) out.push(new ImageRun({ type: image.type, data: image.data, transformation: { width: run.width, height: run.height } }));
        continue;
      }
      const lines = run.text.split("\n");
      const parts = lines.map((line, i) => (i === 0 ? textRun(line, run.style) : new TextRun({ text: line, break: 1 })));
      out.push(...(run.link ? [new ExternalHyperlink({ link: run.link, children: parts })] : parts));
    }
    return out;
  };

  // One numbering instance per ordered list so numbering restarts per list.
  let listInstance = 0;
  const instanceFor = new Map<string, number>();

  const paragraphFor = async (block: ExportParagraph, listKey: string) => {
    const options: Record<string, unknown> = { children: await runsFor(block.runs), alignment: alignments[block.align] };
    if (block.heading !== null) options.heading = headings[block.heading];
    if (block.list?.ordered) {
      if (!instanceFor.has(listKey)) instanceFor.set(listKey, (listInstance += 1));
      options.numbering = { reference: "atm-ordered", level: block.list.level, instance: instanceFor.get(listKey) };
    } else if (block.list) {
      options.bullet = { level: block.list.level };
    }
    return new Paragraph(options as ConstructorParameters<typeof Paragraph>[0]);
  };

  const childrenFor = async (blocks: ExportBlock[], scope: string): Promise<Child[]> => {
    const out: Child[] = [];
    let listRun = 0;
    let previousOrdered = false;
    for (const block of blocks) {
      if (block.kind === "pageBreak") {
        out.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      } else if (block.kind === "table") {
        out.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: await Promise.all(
              block.rows.map(
                async (cells, r) =>
                  new TableRow({
                    children: await Promise.all(
                      cells.map(async (cell, c) => {
                        const content = await childrenFor(cell, `${scope}.t${r}.${c}`);
                        return new TableCell({ children: content.length ? content : [new Paragraph("")] });
                      }),
                    ),
                  }),
              ),
            ),
          }),
        );
      } else {
        const ordered = Boolean(block.list?.ordered);
        // A non-list paragraph between two numbered runs starts a new list.
        if (ordered && !previousOrdered && block.list?.number === 1) listRun += 1;
        previousOrdered = ordered;
        out.push(await paragraphFor(block, `${scope}.l${listRun}`));
      }
    }
    return out;
  };

  const sections = await Promise.all(
    tabs.map(async (tab, index) => {
      const page = pageMetrics(printableData(tab));
      return {
        properties: {
          page: {
            size: {
              width: Math.round((page.landscape ? page.height : page.width) * PX_TO_TWIP),
              height: Math.round((page.landscape ? page.width : page.height) * PX_TO_TWIP),
              orientation: page.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: Math.round(page.margin.top * PX_TO_TWIP),
              bottom: Math.round(page.margin.bottom * PX_TO_TWIP),
              left: Math.round(page.margin.left * PX_TO_TWIP),
              right: Math.round(page.margin.right * PX_TO_TWIP),
            },
          },
        },
        children: await childrenFor(documentToBlocks(tab.data), `tab${index}`),
      };
    }),
  );

  const document = new Document({
    creator: "ATM",
    title,
    numbering: {
      config: [
        {
          reference: "atm-ordered",
          levels: Array.from({ length: 9 }, (_, level) => ({
            level,
            format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections,
  });
  downloadBlob(await Packer.toBlob(document), `${safeFilename(title)}.docx`);
}

// ── HTML rendering (used for PDF) ────────────────────────────────────────────

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function runHtml(run: ExportRun) {
  if (run.kind === "image") return `<img src="${escapeHtml(run.src)}" width="${run.width}" height="${run.height}" style="vertical-align:bottom" crossorigin="anonymous">`;
  const s = run.style;
  const css = [
    s.ff ? `font-family:'${s.ff.replace(/'/g, "")}'` : "",
    s.fs ? `font-size:${s.fs}pt` : "",
    s.bl === 1 ? "font-weight:700" : "",
    s.it === 1 ? "font-style:italic" : "",
    [s.ul?.s === 1 ? "underline" : "", s.st?.s === 1 ? "line-through" : ""].filter(Boolean).length
      ? `text-decoration:${[s.ul?.s === 1 ? "underline" : "", s.st?.s === 1 ? "line-through" : ""].filter(Boolean).join(" ")}`
      : "",
    hexColor(s.cl?.rgb) ? `color:#${hexColor(s.cl?.rgb)}` : "",
    hexColor(s.bg?.rgb) ? `background:#${hexColor(s.bg?.rgb)}` : "",
    s.va === 3 ? "vertical-align:super;font-size:0.75em" : s.va === 2 ? "vertical-align:sub;font-size:0.75em" : "",
  ]
    .filter(Boolean)
    .join(";");
  const text = escapeHtml(run.text).replace(/\n/g, "<br>").replace(/\t/g, "&emsp;");
  const span = css ? `<span style="${css}">${text}</span>` : text;
  return run.link ? `<a href="${escapeHtml(run.link)}" style="color:#1d4ed8">${span}</a>` : span;
}

const headingCss: Record<string, string> = {
  title: "font-size:26pt;font-weight:400;margin:0 0 6pt",
  subtitle: "font-size:15pt;color:#555;margin:0 0 10pt",
  1: "font-size:20pt;font-weight:400;margin:14pt 0 6pt",
  2: "font-size:16pt;font-weight:400;margin:12pt 0 4pt",
  3: "font-size:14pt;font-weight:400;color:#333;margin:10pt 0 4pt",
  4: "font-size:12pt;color:#444;margin:8pt 0 4pt",
  5: "font-size:11pt;color:#444;margin:8pt 0 4pt",
};

function blocksHtml(blocks: ExportBlock[]): string {
  return blocks
    .map((block) => {
      if (block.kind === "pageBreak") return `<div data-page-break="1"></div>`;
      if (block.kind === "table") {
        const rows = block.rows
          .map((cells) => `<tr>${cells.map((cell) => `<td style="border:1px solid #9ca3af;padding:4pt 6pt;vertical-align:top">${blocksHtml(cell)}</td>`).join("")}</tr>`)
          .join("");
        return `<table style="border-collapse:collapse;width:100%;margin:6pt 0">${rows}</table>`;
      }
      const content = block.runs.map(runHtml).join("") || "&nbsp;";
      const align = block.align === "left" ? "" : `text-align:${block.align};`;
      const style = block.heading !== null ? headingCss[block.heading] : "margin:0 0 6pt";
      if (block.list) {
        const marker = block.list.ordered ? `${block.list.number}.` : ["•", "◦", "▪"][block.list.level % 3];
        return `<div style="${align}${style};display:flex;gap:6pt;padding-left:${18 * (block.list.level + 1)}pt"><span>${marker}</span><span>${content}</span></div>`;
      }
      return `<div style="${align}${style}">${content}</div>`;
    })
    .join("");
}

// ── PDF ──────────────────────────────────────────────────────────────────────

/** Choose slice points at block boundaries so lines aren't cut across pages. */
function pageCuts(container: HTMLElement, pageHeight: number) {
  const top = container.getBoundingClientRect().top;
  const blocks = [...container.children].map((element) => {
    const rect = element.getBoundingClientRect();
    return { start: rect.top - top, end: rect.bottom - top, forceBreak: (element as HTMLElement).dataset.pageBreak === "1" };
  });
  const total = container.scrollHeight;
  const cuts: Array<[number, number]> = [];
  let start = 0;
  while (start < total - 1) {
    let end = Math.min(start + pageHeight, total);
    const forced = blocks.find((block) => block.forceBreak && block.start > start && block.start < end);
    if (forced) end = forced.start;
    else if (end < total) {
      const fitting = blocks.filter((block) => block.end <= end && block.end > start).map((block) => block.end);
      const best = Math.max(...fitting, 0);
      if (best > start + pageHeight * 0.3) end = best; // otherwise one block is taller than a page: hard cut
    }
    cuts.push([start, end]);
    start = end;
  }
  return cuts.length ? cuts : [[0, Math.max(total, 1)]];
}

export async function downloadDocumentPdf(title: string, tabs: DocTab[]) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  let pdf: InstanceType<typeof jsPDF> | null = null;
  const SCALE = 2;

  for (const tab of tabs) {
    const page = pageMetrics(printableData(tab));
    const contentWidth = page.width - page.margin.left - page.margin.right;
    const contentHeight = page.height - page.margin.top - page.margin.bottom;

    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-100000px;top:0;width:${contentWidth}px;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.4`;
    host.innerHTML = blocksHtml(documentToBlocks(tab.data));
    document.body.appendChild(host);
    try {
      await Promise.all([...host.querySelectorAll("img")].map((img) => (img.complete ? null : new Promise((resolve) => ((img.onload = resolve), (img.onerror = resolve))))));
      const canvas = await html2canvas(host, { scale: SCALE, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const format: [number, number] = [page.width * PX_TO_PT, page.height * PX_TO_PT];
      const orientation = page.width > page.height ? "landscape" : "portrait";

      for (const [start, end] of pageCuts(host, contentHeight)) {
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.max(1, Math.round((end - start) * SCALE));
        slice.getContext("2d")!.drawImage(canvas, 0, Math.round(start * SCALE), canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        if (!pdf) pdf = new jsPDF({ unit: "pt", format, orientation });
        else pdf.addPage(format, orientation);
        pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", page.margin.left * PX_TO_PT, page.margin.top * PX_TO_PT, contentWidth * PX_TO_PT, (end - start) * PX_TO_PT);
      }
    } finally {
      host.remove();
    }
  }
  pdf?.save(`${safeFilename(title)}.pdf`);
}
