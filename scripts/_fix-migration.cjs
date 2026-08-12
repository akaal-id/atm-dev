const fs = require("fs");
const path = require("path");

// Fix hub-page imports
const hubPage = "src/components/hub/hub-page/hub-page.tsx";
let s = fs.readFileSync(hubPage, "utf8");
s = s.replace(/import styles from ["']@\/app\/hub\.module\.css["'];\r?\n/, "");
const lines = s.split(/\r?\n/);
let seenStyles = false;
const out = [];
for (const line of lines) {
  if (/^import styles from /.test(line)) {
    if (seenStyles) {
      console.log("removed dup styles import:", line);
      continue;
    }
    seenStyles = true;
    if (!line.includes("./hub-page.module.css")) {
      out.push('import styles from "./hub-page.module.css";');
      continue;
    }
  }
  out.push(line);
}
fs.writeFileSync(hubPage, out.join("\n"));
console.log("hub-page.tsx import lines:");
out.filter((l) => l.includes("import")).forEach((l) => console.log(" ", l));

// Fix type=styles.hidden across migrated folders
const roots = ["src/components/ui", "src/components/hub"];
function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}
let hiddenFixes = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    if (file.includes(`${path.sep}button${path.sep}`)) continue;
    let src = fs.readFileSync(file, "utf8");
    const next = src
      .replace(/type=\{styles\.hidden\}/g, 'type="hidden"')
      .replace(/type=styles\.hidden/g, 'type="hidden"');
    if (next !== src) {
      fs.writeFileSync(file, next);
      hiddenFixes++;
      console.log("fixed type=hidden in", file);
    }
  }
}
console.log("hiddenFixes=", hiddenFixes);

// Deduplicate import styles lines in all touched folders
const folders = [
  "date-picker-field","date-range-picker-field","filter-select","form-select","input",
  "linkified-text","modal-portal","modal","pagination","popover","select","status-pill","toast"
].map((n) => path.join("src/components/ui", n));
folders.push("src/components/hub/hub-page");
let dupFixes = 0;
for (const folder of folders) {
  for (const file of walk(folder)) {
    let src = fs.readFileSync(file, "utf8");
    const flines = src.split(/\r?\n/);
    let seen = false;
    const fout = [];
    let changed = false;
    for (const line of flines) {
      if (/^import styles from /.test(line)) {
        if (seen) { changed = true; continue; }
        seen = true;
      }
      fout.push(line);
    }
    if (changed) {
      fs.writeFileSync(file, fout.join("\n"));
      dupFixes++;
      console.log("deduped styles import", file);
    }
  }
}
console.log("dupFixes=", dupFixes);

// Ensure index.ts for each migrated folder
const expected = {
  "src/components/ui/date-picker-field": "DatePickerField",
  "src/components/ui/date-range-picker-field": "DateRangePickerField",
  "src/components/ui/filter-select": "FilterSelect",
  "src/components/ui/form-select": "FormSelect",
  "src/components/ui/input": "Input",
  "src/components/ui/linkified-text": "LinkifiedText",
  "src/components/ui/modal-portal": "ModalPortal",
  "src/components/ui/modal": "Modal",
  "src/components/ui/pagination": "Pagination",
  "src/components/ui/popover": null, // inspect
  "src/components/ui/select": null,
  "src/components/ui/status-pill": "StatusPill",
  "src/components/ui/toast": null,
  "src/components/hub/hub-page": "HubPage",
};

for (const [folder, hint] of Object.entries(expected)) {
  const base = path.basename(folder);
  const tsx = path.join(folder, `${base}.tsx`);
  const indexPath = path.join(folder, "index.ts");
  const src = fs.readFileSync(tsx, "utf8");
  // Collect export names
  const named = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const|class|type|interface|enum)\s+([A-Za-z0-9_]+)/g)].map(m => m[1]);
  const reExports = [...src.matchAll(/export\s*\{([^}]+)\}/g)].flatMap(m => m[1].split(",").map(x => x.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean));
  const all = [...new Set([...named, ...reExports])].filter((n) => !["default"].includes(n));
  // Prefer types/interfaces with export type
  const typeOnly = new Set([...src.matchAll(/export\s+type\s+(?:\{[^}]+\}|([A-Za-z0-9_]+))/g)].map(m => m[1]).filter(Boolean));
  const typeExports = [...src.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/g)].map(m => m[1]);

  let content;
  if (fs.existsSync(indexPath)) {
    content = fs.readFileSync(indexPath, "utf8");
    console.log("existing index", indexPath, "=>", content.trim());
  } else {
    // Build export line from main file exports that look like components/values
    const valueExports = all.filter((n) => !typeExports.includes(n) || named.includes(n));
    // For select/popover/toast often many exports - re-export *
    if (valueExports.length > 3 || base === "select" || base === "popover" || base === "toast") {
      content = `export * from "./${base}";\n`;
    } else if (valueExports.length === 0 && hint) {
      content = `export { ${hint} } from "./${base}";\n`;
    } else {
      const vals = valueExports.length ? valueExports : (hint ? [hint] : []);
      const types = typeExports.filter((t) => !vals.includes(t));
      const parts = [];
      if (vals.length) parts.push(`export { ${vals.join(", ")} } from "./${base}";`);
      if (types.length) parts.push(`export type { ${types.join(", ")} } from "./${base}";`);
      content = (parts.join("\n") || `export * from "./${base}";`) + "\n";
    }
    fs.writeFileSync(indexPath, content);
    console.log("created index", indexPath, "=>", content.trim());
  }
}
