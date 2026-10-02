// Run: npx tsx tests/unit/office-doc-export.test.ts
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

import { applyPageSetup, defaultPageSetup, newDocumentData, readPageSetup, type PageSetup } from "@/lib/office-doc";
import { downloadDocumentDocx } from "@/lib/office-doc-export";

// Minimal DOM stubs: capture the Blob handed to the download link.
let captured: Blob | null = null;
(globalThis as Record<string, unknown>).document = {
  createElement: () => ({ click() {}, remove() {}, set href(_v: string) {}, set download(_v: string) {} }),
  body: { appendChild() {} },
};
URL.createObjectURL = ((blob: Blob) => ((captured = blob), "blob:test")) as typeof URL.createObjectURL;
URL.revokeObjectURL = () => {};
(globalThis as Record<string, unknown>).window = { setTimeout };

const png1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const T = "\u001A", R = "\u001B", C = "\u001C", CE = "\u001D", RE = "\u000E", TE = "\u000F";
let s = "";
const paragraphs: Array<{ startIndex: number } & Record<string, unknown>> = [];
const para = (text: string, extra: Record<string, unknown> = {}) => {
  s += text;
  paragraphs.push({ startIndex: s.length, ...extra });
  s += "\r";
};
para("Laporan Bulanan", { paragraphStyle: { namedStyleType: 4 } });
const boldAt = s.length;
para("Teks tebal merah");
para("satu", { bullet: { listType: "ORDER_LIST", listId: "L", nestingLevel: 0 } });
s += T + R + C; para("Sel A"); s += CE + C; para("Sel B"); s += CE + RE + TE;
const imgAt = s.length; s += "\b"; paragraphs.push({ startIndex: s.length }); s += "\r";
const linkAt = s.length; para("akaal.id");
s += "\n";

const base = applyPageSetup(newDocumentData("x"), { ...defaultPageSetup, paper: "A4", orientation: "landscape", margins: { top: 2, bottom: 2, left: 2, right: 2 } });

// Pageless tab that remembers F4 portrait for downloads.
const f4: PageSetup = { ...defaultPageSetup, mode: "pageless", pagelessWidth: "wide", paper: "F4" };
const pageless = applyPageSetup(newDocumentData("p"), f4);
assert.equal(pageless.documentStyle.documentFlavor, 2, "pageless uses Univer MODERN flavor");
assert.equal(readPageSetup(pageless, f4).mode, "pageless");
assert.equal(readPageSetup(pageless).pagelessWidth, "wide", "width is recovered without stored setup");
const data = {
  ...base,
  body: {
    dataStream: s,
    paragraphs,
    sectionBreaks: [{ startIndex: s.length - 1 }],
    textRuns: [{ st: boldAt, ed: boldAt + 4, ts: { bl: 1, cl: { rgb: "#ff0000" }, ff: "Georgia", fs: 14 } }],
    customBlocks: [{ startIndex: imgAt, blockId: "img" }],
    customRanges: [{ startIndex: linkAt, endIndex: linkAt + 7, rangeType: 0, properties: { url: "https://akaal.id" } }],
  },
  drawings: { img: { source: png1x1, docTransform: { size: { width: 40, height: 40 } } } },
};

async function main() {
await downloadDocumentDocx("Test", [
  { id: "t1", title: "Tab 1", data },
  { id: "t2", title: "Tab 2", data: newDocumentData("y") },
  { id: "t3", title: "Pageless", data: pageless, setup: f4 },
]);
assert.ok(captured, "a .docx blob was produced");
const bytes = Buffer.from(await captured!.arrayBuffer());
writeFileSync(process.argv[2] ?? "/dev/null", bytes);

const { default: JSZip } = await import("jszip");
const zip = await JSZip.loadAsync(bytes);
const xml = await zip.file("word/document.xml")!.async("string");
const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
const checks: Array<[string, boolean]> = [
  ["heading 1 style", /<w:pStyle w:val="Heading1"\/>/.test(xml)],
  ["bold run", /<w:b\/>[\s\S]*?Teks/.test(xml) || /<w:b w:val="true"\/>/.test(xml)],
  ["red colour", /<w:color w:val="FF0000"\/>/.test(xml)],
  ["Georgia font", /w:ascii="Georgia"/.test(xml)],
  ["14pt size", /<w:sz w:val="28"\/>/.test(xml)],
  ["numbered list", /<w:numPr>/.test(xml)],
  ["table with 2 cells", (xml.match(/<w:tc>/g) ?? []).length === 2],
  ["image embedded", Object.keys(zip.files).some((name) => name.startsWith("word/media/"))],
  ["hyperlink", /<w:hyperlink/.test(xml) && rels.includes("https://akaal.id")],
  ["landscape A4 section", /w:orient="landscape"/.test(xml)],
  ["three sections (tabs)", (xml.match(/<w:sectPr/g) ?? []).length === 3],
  // F4 = 21.5 × 33 cm → 12189 × 18709 twips; pageless tab exports on its remembered paper
  ["pageless tab exported on F4 portrait", /<w:pgSz w:w="1218\d" w:h="1870\d"/.test(xml)],
];
for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
assert.ok(checks.every(([, ok]) => ok), "all DOCX checks pass");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
