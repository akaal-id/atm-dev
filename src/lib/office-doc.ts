/**
 * Office documents: tabbed Univer Docs data, page setup, HTML import, and a
 * walker that flattens Univer's document model into export blocks (DOCX / PDF).
 *
 * Univer numeric enums are inlined (with names) so this module doesn't pull
 * @univerjs/core into every bundle that only needs to export.
 */

// ── Univer document model (subset we read and write) ─────────────────────────

type ColorStyle = { rgb?: string | null };
type Decoration = { s?: number };
export type DocTextStyle = {
  ff?: string | null;
  fs?: number;
  it?: number;
  bl?: number;
  ul?: Decoration;
  st?: Decoration;
  bg?: ColorStyle | null;
  cl?: ColorStyle | null;
  va?: number | null; // BaselineOffset: 2 subscript, 3 superscript
};
type Paragraph = {
  startIndex: number;
  paragraphId?: string;
  paragraphStyle?: { namedStyleType?: number; horizontalAlign?: number };
  bullet?: { listType: string; listId: string; nestingLevel: number };
};
type SectionBreak = { startIndex: number; [key: string]: unknown };
type Body = {
  dataStream: string;
  textRuns?: Array<{ st: number; ed: number; ts?: DocTextStyle }>;
  paragraphs?: Paragraph[];
  sectionBreaks?: SectionBreak[];
  customBlocks?: Array<{ startIndex: number; blockId: string }>;
  tables?: Array<{ startIndex: number; endIndex: number; tableId: string }>;
  customRanges?: Array<{ startIndex: number; endIndex: number; rangeType: number; properties?: { url?: string } }>;
};
type Drawing = { source?: string; imageSourceType?: string; docTransform?: { size?: { width?: number; height?: number } } };
export type DocumentData = {
  id: string;
  title?: string;
  body?: Body;
  documentStyle: {
    pageSize?: { width?: number; height?: number };
    pageOrient?: number; // 0 portrait, 1 landscape
    documentFlavor?: number; // 1 TRADITIONAL (paged)
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    [key: string]: unknown;
  };
  drawings?: Record<string, Drawing>;
  drawingsOrder?: string[];
  [key: string]: unknown;
};

const NamedStyle = { TITLE: 2, SUBTITLE: 3, HEADING_1: 4, HEADING_2: 5, HEADING_3: 6, HEADING_4: 7, HEADING_5: 8 } as const;
const Align = { LEFT: 1, CENTER: 2, RIGHT: 3, JUSTIFIED: 4, BOTH: 5 } as const;
const HYPERLINK = 0;
const PAGE_DPI = 96;

// ── Tabs ─────────────────────────────────────────────────────────────────────

export type DocTab = {
  id: string;
  title: string;
  data: DocumentData;
  /** Page setup chosen for this tab; keeps the paper settings while the tab is pageless (used for export). */
  setup?: PageSetup;
};
export type DocSnapshot = { version: 2; tabs: DocTab[] };

const randomId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

// ── Page setup ───────────────────────────────────────────────────────────────

const cm = (value: number) => (value / 2.54) * PAGE_DPI;

/** Paper sizes in 96-DPI layout pixels (portrait). */
export const paperSizes = {
  A4: { label: "A4 (21 × 29.7 cm)", width: cm(21), height: cm(29.7) },
  F4: { label: "F4 / Folio (21.5 × 33 cm)", width: cm(21.5), height: cm(33) },
  Letter: { label: "Letter (8.5 × 11 in)", width: 8.5 * PAGE_DPI, height: 11 * PAGE_DPI },
  Legal: { label: "Legal (8.5 × 14 in)", width: 8.5 * PAGE_DPI, height: 14 * PAGE_DPI },
  A5: { label: "A5 (14.8 × 21 cm)", width: cm(14.8), height: cm(21) },
} as const;
export type PaperKey = keyof typeof paperSizes;

/** Content width of pageless (continuous) documents — same values as Univer's built-in modern widths. */
export const pagelessWidths = {
  narrow: { label: "Narrow", width: paperSizes.A4.width },
  medium: { label: "Medium", width: 960 },
  wide: { label: "Wide", width: cm(29.7) },
} as const;
export type PagelessWidth = keyof typeof pagelessWidths;
const PAGELESS_MARGIN = 50 / 0.75; // Univer MODERN_DOCUMENT_DEFAULT_MARGIN

export type PageSetup = {
  /** `pages` = paginated like Word (Univer TRADITIONAL); `pageless` = one continuous canvas (Univer MODERN). */
  mode: "pages" | "pageless";
  pagelessWidth: PagelessWidth;
  paper: PaperKey;
  orientation: "portrait" | "landscape";
  /** Margins in centimetres. */
  margins: { top: number; bottom: number; left: number; right: number };
};

export const defaultPageSetup: PageSetup = {
  mode: "pages",
  pagelessWidth: "medium",
  paper: "A4",
  orientation: "portrait",
  margins: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 },
};

const isPageless = (data: DocumentData) => data.documentStyle?.documentFlavor === 2;

/**
 * Current page setup of a tab: the stored setup when present (it remembers paper settings
 * while pageless), else derived from the document. The mode always follows the document.
 */
export function readPageSetup(data: DocumentData, stored?: PageSetup): PageSetup {
  if (stored) return { ...defaultPageSetup, ...stored, mode: isPageless(data) ? "pageless" : "pages" };
  if (isPageless(data)) {
    const width = Number(data.documentStyle?.pageSize?.width ?? pagelessWidths.medium.width);
    const pagelessWidth = (Object.entries(pagelessWidths).find(([, option]) => Math.abs(option.width - width) < 4)?.[0] as PagelessWidth | undefined) ?? "medium";
    return { ...defaultPageSetup, mode: "pageless", pagelessWidth };
  }
  const style = data.documentStyle ?? {};
  const landscape = style.pageOrient === 1;
  const width = Number(style.pageSize?.width ?? paperSizes.A4.width);
  const height = Number(style.pageSize?.height ?? paperSizes.A4.height);
  const [short, long] = [Math.min(width, height), Math.max(width, height)];
  const paper =
    (Object.entries(paperSizes).find(([, size]) => Math.abs(size.width - short) < 4 && Math.abs(size.height - long) < 4)?.[0] as PaperKey | undefined) ?? "A4";
  const toCm = (px: unknown, fallback: number) => (typeof px === "number" ? Math.round((px / PAGE_DPI) * 2.54 * 100) / 100 : fallback);
  return {
    mode: "pages",
    pagelessWidth: "medium",
    paper,
    orientation: landscape ? "landscape" : "portrait",
    margins: {
      top: toCm(style.marginTop, 2.54),
      bottom: toCm(style.marginBottom, 2.54),
      left: toCm(style.marginLeft, 2.54),
      right: toCm(style.marginRight, 2.54),
    },
  };
}

function pageStyle(setup: PageSetup) {
  if (setup.mode === "pageless") {
    return {
      documentFlavor: 2,
      pageSize: { width: pagelessWidths[setup.pagelessWidth].width, height: paperSizes.A4.height },
      pageOrient: 0,
      marginTop: PAGELESS_MARGIN,
      marginBottom: PAGELESS_MARGIN,
      marginLeft: PAGELESS_MARGIN,
      marginRight: PAGELESS_MARGIN,
    };
  }
  const paper = paperSizes[setup.paper];
  const landscape = setup.orientation === "landscape";
  return {
    documentFlavor: 1,
    pageSize: { width: landscape ? paper.height : paper.width, height: landscape ? paper.width : paper.height },
    pageOrient: landscape ? 1 : 0,
    marginTop: cm(setup.margins.top),
    marginBottom: cm(setup.margins.bottom),
    marginLeft: cm(setup.margins.left),
    marginRight: cm(setup.margins.right),
  };
}

/** Apply page setup to the document style and every section (sections may override it). */
export function applyPageSetup(data: DocumentData, setup: PageSetup): DocumentData {
  const { documentFlavor, ...style } = pageStyle(setup);
  const sectionBreaks = data.body?.sectionBreaks?.map((section) => ({ ...section, ...style }));
  return {
    ...data,
    documentStyle: { ...data.documentStyle, ...style, documentFlavor },
    body: data.body ? { ...data.body, ...(sectionBreaks ? { sectionBreaks } : {}) } : data.body,
  };
}

// ── Creating documents ───────────────────────────────────────────────────────

export function newDocumentData(title: string, setup: PageSetup = defaultPageSetup): DocumentData {
  return applyPageSetup(
    {
      id: randomId("doc_"),
      title,
      body: {
        dataStream: "\r\n",
        textRuns: [],
        paragraphs: [{ startIndex: 0, paragraphId: randomId("p_") }],
        sectionBreaks: [{ startIndex: 1 }],
      },
      documentStyle: { documentFlavor: 1 },
    },
    setup,
  );
}

export function newTab(title: string, setup: PageSetup = defaultPageSetup): DocTab {
  return { id: randomId("tab_"), title, data: newDocumentData(title, setup), setup };
}

/** The tab's document laid out on paper — pageless tabs export with their remembered paper settings. */
export function printableData(tab: DocTab): DocumentData {
  if (!isPageless(tab.data)) return tab.data;
  return applyPageSetup(tab.data, { ...readPageSetup(tab.data, tab.setup), mode: "pages" });
}

/**
 * Turn stored file data into tabs: the v2 snapshot, else legacy/imported HTML
 * (e.g. notes saved from chat), else a blank document.
 */
export function toDocSnapshot(raw: unknown, legacyHtml: string, title: string): DocSnapshot {
  const snapshot = raw as Partial<DocSnapshot> | null;
  if (snapshot?.version === 2 && Array.isArray(snapshot.tabs) && snapshot.tabs.length > 0) return snapshot as DocSnapshot;
  if (legacyHtml.trim()) return { version: 2, tabs: [{ id: randomId("tab_"), title: "Tab 1", data: htmlToDocumentData(legacyHtml, title) }] };
  return { version: 2, tabs: [{ ...newTab("Tab 1"), data: newDocumentData(title) }] };
}

/** Convert simple rich-text HTML (paragraphs, headings, lists, bold/italic/underline/strike) to Univer data. Browser only. */
export function htmlToDocumentData(html: string, title: string): DocumentData {
  const data = newDocumentData(title);
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstElementChild;
  let stream = "";
  const paragraphs: Paragraph[] = [];
  const textRuns: NonNullable<Body["textRuns"]> = [];

  const endParagraph = (extra: Partial<Paragraph> = {}) => {
    paragraphs.push({ startIndex: stream.length, paragraphId: randomId("p_"), ...extra });
    stream += "\r";
  };

  const pushRuns = (node: Node, style: DocTextStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/[\r\n]+/g, " ");
      if (!text) return;
      const start = stream.length;
      stream += text;
      if (Object.keys(style).length) textRuns.push({ st: start, ed: stream.length, ts: { ...style } });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "br") {
      endParagraph(); // Univer has no soft line break token; a <br> starts a new paragraph
      return;
    }
    const next = { ...style };
    if (tag === "strong" || tag === "b") next.bl = 1;
    if (tag === "em" || tag === "i") next.it = 1;
    if (tag === "u") next.ul = { s: 1 };
    if (tag === "s" || tag === "del" || tag === "strike") next.st = { s: 1 };
    node.childNodes.forEach((child) => pushRuns(child, next));
  };

  const walk = (element: Element) => {
    for (const child of [...element.children]) {
      const tag = child.tagName.toLowerCase();
      const heading = { h1: NamedStyle.HEADING_1, h2: NamedStyle.HEADING_2, h3: NamedStyle.HEADING_3, h4: NamedStyle.HEADING_4 }[tag];
      if (heading) {
        pushRuns(child, {});
        endParagraph({ paragraphStyle: { namedStyleType: heading } });
      } else if (tag === "ul" || tag === "ol") {
        const listId = randomId("list_");
        for (const item of [...child.children]) {
          [...item.childNodes].forEach((part) => {
            if (!(part instanceof HTMLElement && /^(UL|OL)$/.test(part.tagName))) pushRuns(part, {});
          });
          endParagraph({ bullet: { listType: tag === "ol" ? "ORDER_LIST" : "BULLET_LIST", listId, nestingLevel: 0 } });
        }
      } else if (tag === "blockquote" || (tag === "div" && child.querySelector("p,ul,ol,h1,h2,h3"))) {
        walk(child);
      } else {
        pushRuns(child, {});
        endParagraph();
      }
    }
  };

  if (root) walk(root);
  if (!paragraphs.length) endParagraph();
  return {
    ...data,
    body: { ...data.body!, dataStream: `${stream}\n`, paragraphs, textRuns, sectionBreaks: [{ ...data.body!.sectionBreaks![0], startIndex: stream.length }] },
  };
}

// ── Export walker ────────────────────────────────────────────────────────────

export type ExportRun =
  | { kind: "text"; text: string; style: DocTextStyle; link?: string }
  | { kind: "image"; src: string; width: number; height: number };

export type ExportParagraph = {
  kind: "paragraph";
  runs: ExportRun[];
  heading: "title" | "subtitle" | 1 | 2 | 3 | 4 | 5 | null;
  align: "left" | "center" | "right" | "justify";
  list: { ordered: boolean; level: number; number: number } | null;
};
export type ExportTable = { kind: "table"; rows: ExportBlock[][][] };
export type ExportBlock = ExportParagraph | ExportTable | { kind: "pageBreak" };

const headingFor = (named?: number): ExportParagraph["heading"] => {
  switch (named) {
    case NamedStyle.TITLE:
      return "title";
    case NamedStyle.SUBTITLE:
      return "subtitle";
    case NamedStyle.HEADING_1:
      return 1;
    case NamedStyle.HEADING_2:
      return 2;
    case NamedStyle.HEADING_3:
      return 3;
    case NamedStyle.HEADING_4:
      return 4;
    case NamedStyle.HEADING_5:
      return 5;
    default:
      return null;
  }
};

const alignFor = (value?: number): ExportParagraph["align"] =>
  value === Align.CENTER ? "center" : value === Align.RIGHT ? "right" : value === Align.JUSTIFIED || value === Align.BOTH ? "justify" : "left";

function sameStyle(a: DocTextStyle, b: DocTextStyle) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Flatten a Univer document into paragraphs / tables / page breaks with resolved list numbers. */
export function documentToBlocks(data: DocumentData): ExportBlock[] {
  const body = data.body;
  if (!body?.dataStream) return [];
  const stream = body.dataStream;
  const paragraphAt = new Map((body.paragraphs ?? []).map((paragraph) => [paragraph.startIndex, paragraph]));
  const blockAt = new Map((body.customBlocks ?? []).map((block) => [block.startIndex, block.blockId]));
  const runs = [...(body.textRuns ?? [])].sort((a, b) => a.st - b.st);
  const links = (body.customRanges ?? []).filter((range) => range.rangeType === HYPERLINK && range.properties?.url);
  const counters = new Map<string, number[]>();

  const styleAt = (index: number): DocTextStyle => runs.find((run) => run.st <= index && index < run.ed)?.ts ?? {};
  const linkAt = (index: number) => links.find((range) => range.startIndex <= index && index <= range.endIndex)?.properties?.url;

  const root: ExportBlock[] = [];
  // Container stack: blocks of the current cell (or root). Tables nest as rows → cells → blocks.
  const containers: ExportBlock[][] = [root];
  const tables: ExportTable[] = [];
  let current: ExportRun[] = [];

  const appendText = (text: string, index: number) => {
    const style = styleAt(index);
    const link = linkAt(index);
    const last = current[current.length - 1];
    if (last && last.kind === "text" && sameStyle(last.style, style) && last.link === link) last.text += text;
    else current.push({ kind: "text", text, style, link });
  };

  const flushParagraph = (index: number) => {
    const paragraph = paragraphAt.get(index);
    let list: ExportParagraph["list"] = null;
    if (paragraph?.bullet) {
      const ordered = /ORDER/.test(paragraph.bullet.listType);
      const level = paragraph.bullet.nestingLevel ?? 0;
      const levels = counters.get(paragraph.bullet.listId) ?? [];
      levels[level] = (levels[level] ?? 0) + 1;
      levels.length = level + 1; // reset deeper levels
      counters.set(paragraph.bullet.listId, levels);
      list = { ordered, level, number: levels[level] };
    }
    containers[containers.length - 1].push({
      kind: "paragraph",
      runs: current,
      heading: headingFor(paragraph?.paragraphStyle?.namedStyleType),
      align: alignFor(paragraph?.paragraphStyle?.horizontalAlign),
      list,
    });
    current = [];
  };

  for (let index = 0; index < stream.length; index += 1) {
    const char = stream[index];
    switch (char) {
      case "\r":
        flushParagraph(index);
        break;
      case "\n":
      case "\u001F":
      case "\u001E":
      case "\u0010":
      case "\u0011":
      case "\0":
        break; // section breaks and range / block markers carry no text
      case "\u001A": {
        const table: ExportTable = { kind: "table", rows: [] };
        containers[containers.length - 1].push(table);
        tables.push(table);
        break;
      }
      case "\u001B":
        tables[tables.length - 1]?.rows.push([]);
        break;
      case "\u001C": {
        const table = tables[tables.length - 1];
        const cell: ExportBlock[] = [];
        table?.rows[table.rows.length - 1]?.push(cell);
        containers.push(cell);
        break;
      }
      case "\u001D":
        if (current.length) flushParagraph(-1);
        if (containers.length > 1) containers.pop();
        break;
      case "\u000E":
        break;
      case "\u000F":
        tables.pop();
        break;
      case "\f":
        if (current.length) flushParagraph(-1);
        containers[containers.length - 1].push({ kind: "pageBreak" });
        break;
      case "\v":
        break; // column break: no flow content
      case "\b": {
        const drawing = data.drawings?.[blockAt.get(index) ?? ""];
        if (drawing?.source) {
          current.push({
            kind: "image",
            src: drawing.source,
            width: Number(drawing.docTransform?.size?.width ?? 200),
            height: Number(drawing.docTransform?.size?.height ?? 150),
          });
        }
        break;
      }
      default:
        appendText(char, index);
    }
  }
  if (current.length) flushParagraph(-1);
  return root;
}

/** Content width/height and margins in 96-DPI pixels, for layout of exports. */
export function pageMetrics(data: DocumentData) {
  const style = data.documentStyle ?? {};
  const width = Number(style.pageSize?.width ?? paperSizes.A4.width);
  const height = Number(style.pageSize?.height ?? paperSizes.A4.height);
  const margin = {
    top: Number(style.marginTop ?? 96),
    bottom: Number(style.marginBottom ?? 96),
    left: Number(style.marginLeft ?? 96),
    right: Number(style.marginRight ?? 96),
  };
  return { width, height, margin, landscape: style.pageOrient === 1 };
}
