/**
 * .docx → Univer document: mammoth turns the file into HTML (headings, lists,
 * inline styles, tables, links, images as data URLs), then Univer's own clipboard
 * converter (`convertClipboardHtmlToDocumentData`, the engine behind paste) builds
 * the document model. Univer's native DOCX importer is a paid Pro feature.
 */

import { newDocumentData, pageMetrics, type DocSnapshot, type DocumentData } from "@/lib/office-doc";

type Drawing = {
  source?: string;
  transform?: { width?: number; height?: number; [key: string]: unknown };
  docTransform?: { size?: { width?: number; height?: number }; [key: string]: unknown };
  [key: string]: unknown;
};

/**
 * Univer's converter maps <em>/<i> to bold, so express inline formatting as
 * explicit CSS, which its style parser reads correctly.
 */
function normalizeInlineFormatting(html: string) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const css: Record<string, string> = {
    strong: "font-weight:bold",
    b: "font-weight:bold",
    em: "font-style:italic",
    i: "font-style:italic",
    u: "text-decoration:underline",
    s: "text-decoration:line-through",
    del: "text-decoration:line-through",
  };
  for (const [tag, style] of Object.entries(css)) {
    for (const element of [...doc.body.querySelectorAll(tag)]) {
      const span = doc.createElement("span");
      span.setAttribute("style", style);
      span.append(...element.childNodes);
      element.replaceWith(span);
    }
  }
  return doc.body.firstElementChild?.innerHTML ?? html;
}

function imageSize(source: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

/** Give converted images their natural size (capped to the text width) and register their draw order. */
async function fixDrawings(data: DocumentData) {
  const drawings = (data.drawings ?? {}) as Record<string, Drawing>;
  const ids = Object.keys(drawings);
  if (!ids.length) return;
  const page = pageMetrics(data);
  const maxWidth = page.width - page.margin.left - page.margin.right;
  await Promise.all(
    ids.map(async (id) => {
      const drawing = drawings[id];
      const natural = drawing.source ? await imageSize(drawing.source) : null;
      if (!natural?.width || !natural.height) return;
      const scale = Math.min(1, maxWidth / natural.width);
      const size = { width: Math.round(natural.width * scale), height: Math.round(natural.height * scale) };
      drawing.transform = { ...drawing.transform, ...size };
      drawing.docTransform = { ...drawing.docTransform, size };
    }),
  );
  // Fields Univer sets when it inserts an inline image itself (the HTML converter leaves them out).
  for (const id of ids) {
    drawings[id] = { behindDoc: 0, layoutType: 0, wrapText: 0, distT: 0, distB: 0, distL: 0, distR: 0, ...drawings[id], drawingId: id, unitId: data.id, subUnitId: data.id };
  }
  data.drawingsOrder = ids;
  // The render layer loads images from the drawing plugin's resource, not from `drawings`
  // (which only drives layout) — the same entry Univer writes when it saves a document.
  const resources = ((data.resources as Array<{ name: string }> | undefined) ?? []).filter((resource) => resource.name !== "DOC_DRAWING_PLUGIN");
  data.resources = [...resources, { name: "DOC_DRAWING_PLUGIN", data: JSON.stringify({ data: drawings, order: ids }) }];
}

export async function importDocx(file: File, title: string): Promise<{ snapshot: DocSnapshot; warnings: string[] }> {
  const [mammoth, { convertClipboardHtmlToDocumentData }] = await Promise.all([import("mammoth"), import("@univerjs/docs-ui")]);
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    { styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh", "u => u", "strike => s"] },
  );

  const base = newDocumentData(title);
  const html = normalizeInlineFormatting(result.value || "<p></p>");
  const converted = convertClipboardHtmlToDocumentData(html, base.id) as Partial<DocumentData>;
  // Keep our page setup (A4, paginated); take content and the objects it references.
  const data: DocumentData = {
    ...base,
    ...converted,
    id: base.id,
    title,
    documentStyle: { ...converted.documentStyle, ...base.documentStyle },
    body: converted.body?.dataStream ? converted.body : base.body,
  };
  await fixDrawings(data);

  return {
    snapshot: { version: 2, tabs: [{ id: `tab_${crypto.randomUUID().slice(0, 8)}`, title: "Tab 1", data }] },
    warnings: result.messages.filter((message) => message.type === "warning").map((message) => message.message),
  };
}
