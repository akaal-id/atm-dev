// Run: npm run test:unit
import assert from "node:assert/strict";

import { numfmt } from "@univerjs/core";

import { sheetTable, type Sheet } from "@/lib/sheet-pdf-export";

const format = (pattern: string, value: unknown) => numfmt.format(pattern, value);
const styles = { money: { n: { pattern: "#,##0" } }, head: { bl: 1, bg: { rgb: "#1d4ed8" } } };

const sheet: Sheet = {
  name: "Budget",
  cellData: {
    0: { 0: { v: "Item", s: "head" }, 1: { v: "Q4", s: "head" }, 3: { v: "hidden col" } },
    1: { 0: { v: "Ads" }, 1: { v: 2000000, t: 2, s: "money" } },
    2: { 0: { v: "secret row" } },
    3: { 0: { v: "Merged" } },
    4: { 0: { v: 0.256, s: { n: { pattern: "0.0%" } } }, 1: { v: true } },
  },
  mergeData: [{ startRow: 3, endRow: 3, startColumn: 0, endColumn: 1 }],
  rowData: { 2: { hd: 1 } },
  columnData: { 0: { w: 120 }, 3: { hd: 1 } },
};

const table = sheetTable(sheet, styles, format);
assert.ok(table, "a table is produced for a non-empty sheet");
const html = table!.html;
const checks: Array<[string, boolean]> = [
  ["number format via style id", html.includes(">2,000,000<")],
  ["inline number format", html.includes(">25.6%<")],
  ["boolean shown as TRUE", html.includes(">TRUE<")],
  ["style id resolved (bold + fill)", /font-weight:700[^"]*background:#1d4ed8/.test(html)],
  ["numbers right-aligned", /text-align:right[^>]*>2,000,000/.test(html)],
  ["merge becomes colspan", html.includes('colspan="2"')],
  ["hidden row skipped", !html.includes("secret row")],
  ["hidden column skipped", !html.includes("hidden col")],
  ["column width kept", html.includes("width:120px")],
  ["table width = visible columns", table!.width === 120 + 88 + 88],
  ["empty sheet → no table", sheetTable({ cellData: {} }, styles, format) === null],
];
for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
assert.ok(checks.every(([, ok]) => ok), "all sheet PDF table checks pass");
