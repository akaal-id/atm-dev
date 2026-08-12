/**
 * Final cleanup: rename any class ending in digits, plus lowercase compounds
 * (filterbar, emptytext) to proper camelCase semantic names.
 */
import fs from "node:fs";
import path from "node:path";

function needsRename(name) {
  if (!name || name === "root") return false;
  if (/^size[A-Z]/.test(name)) return false; // button sizes
  if (/[a-z]\d+$/i.test(name)) return true; // sidebar2, hfull3, truncate23, newChat4
  // only all-lowercase broken compounds (not proper camelCase like emptyText)
  if (/^(filterbar|emptytext|dialogpanel|sectionbody|sectiontitle|fieldlabel|pushend|fullwidth|rowreverse)$/.test(name))
    return true;
  if (/Undefined|NewChatNewChat|MainWindowMainWindow|SidebarSidebar/i.test(name)) return true;
  return false;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function collect(css) {
  return [...new Set([...css.matchAll(/\.([A-Za-z_][\w]*)\b/g)].map((m) => m[1]))];
}

function toCamel(s) {
  return String(s)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

function unique(base, used, hints = []) {
  let name = toCamel(base.replace(/\d+$/, ""));
  if (!name) name = "region";
  // fix known lowercase compounds
  const fixes = {
    filterbar: "filterBar",
    emptytext: "emptyText",
    dialogpanel: "dialogPanel",
    sectionbody: "sectionBody",
    sectiontitle: "sectionTitle",
    fieldlabel: "fieldLabel",
    pushend: "pushEnd",
    fullwidth: "fullWidth",
    rowreverse: "rowReverse",
    hfull: "fullHeight",
    truncate: "ellipsis",
    sidebar: "sidebar",
    newchat: "newChat",
    mlauto: "pushEnd",
    mxauto: "centerX",
    mtauto: "pushDown",
    minw: "minWidth",
    cluster: "cluster",
    block: "block",
    glyph: "icon",
    surface: "surface",
    caption: "caption",
    control: "button",
    columns: "columns",
  };
  if (fixes[name.toLowerCase()]) name = fixes[name.toLowerCase()];

  if (!used.has(name) && !needsRename(name)) return name;

  const suffixBank = [
    ...hints.map((h) => toCamel(String(h).replace(/\d+$/, ""))).filter(Boolean),
    "Primary",
    "Secondary",
    "Tertiary",
    "Alt",
    "Aside",
    "Inner",
    "Outer",
    "Lead",
    "Trail",
    "Main",
    "Sub",
    "Head",
    "Foot",
    "Panel",
    "Wrap",
    "Row",
    "Col",
  ];
  for (const s of suffixBank) {
    const alt = name + s[0].toUpperCase() + s.slice(1);
    if (!used.has(alt) && !needsRename(alt)) return alt;
  }
  let i = 1;
  while (used.has(`${name}Area${i}`) || needsRename(`${name}Area${i}`)) i++;
  return `${name}Area${i}`;
}

function infer(tsx, className, used) {
  const idx = tsx.search(new RegExp(`styles\\.${className}\\b`));
  const before = idx >= 0 ? tsx.slice(Math.max(0, idx - 280), idx) : "";
  const after = idx >= 0 ? tsx.slice(idx, Math.min(tsx.length, idx + 160)) : "";
  const fn = [...before.matchAll(/(?:function|const)\s+([A-Z][A-Za-z0-9]*)/g)].pop()?.[1] || "";
  const comment = [...before.matchAll(/\{\/\*\s*([^*]+?)\s*\*\/\}/g)].pop()?.[1];
  const aria = before.match(/aria-label=["']([^"']+)["']/)?.[1];
  const nameAttr = before.match(/\bname=["']([^"']+)["']/)?.[1];
  const tag = before.match(/<([A-Za-z][\w.]*)[^<]*$/)?.[1]?.split(".").pop() || "";
  const hints = [comment, aria, nameAttr, tag, fn].filter(
    (h) => h && h !== "undefined" && h !== "null" && String(h).length > 1,
  );

  if (comment) return unique(comment, used, hints);
  if (aria) return unique(aria, used, hints);
  if (/hfull|fullHeight/i.test(className)) return unique("fullHeight", used, hints);
  if (/truncate|ellipsis/i.test(className)) return unique("ellipsis", used, hints);
  if (/mlauto|pushEnd/i.test(className)) return unique("pushEnd", used, hints);
  if (/mxauto/i.test(className)) return unique("centerX", used, hints);
  if (/mtauto/i.test(className)) return unique("pushDown", used, hints);
  if (/minw/i.test(className)) return unique("minWidth", used, hints);
  if (/newchat|New Chat/i.test(className + before + after)) return unique("newChat", used, hints);
  if (/sidebar|aside|room/i.test(className + before + after)) return unique("sidebar", used, hints);
  if (/filterbar/i.test(className)) return unique("filterBar", used, hints);
  if (/emptytext/i.test(className)) return unique("emptyText", used, hints);
  if (/label/i.test(tag) || /^label/i.test(className)) return unique(nameAttr ? `${nameAttr}Label` : "label", used, hints);
  if (/input|textarea/i.test(tag) || /^input/i.test(className)) return unique(nameAttr ? `${nameAttr}Input` : "input", used, hints);
  if (/button/i.test(tag) || /^button|^control/i.test(className)) return unique("button", used, hints);
  if (/^header/i.test(className)) return unique("header", used, hints);
  if (/^body/i.test(className)) return unique("body", used, hints);
  if (/^text|^caption|^meta/i.test(className)) return unique("caption", used, hints);
  if (/^icon|^glyph/i.test(className)) return unique("icon", used, hints);
  if (/^block|^cluster|^surface|^panel|^region/i.test(className)) return unique("surface", used, hints);
  if (/^dialog/i.test(className)) return unique("dialogPanel", used, hints);
  if (/^sidebar/i.test(className)) return unique("sidebar", used, hints);
  if (/^newchat/i.test(className)) return unique("newChat", used, hints);
  return unique(fn ? `${fn}Block` : className, used, hints);
}

function processPair(tsxPath, cssPath) {
  let tsx = fs.readFileSync(tsxPath, "utf8");
  let css = fs.readFileSync(cssPath, "utf8");
  const bad = collect(css).filter(needsRename);
  if (!bad.length) return 0;
  const used = new Set(collect(css).filter((c) => !needsRename(c)));
  const mapping = new Map();
  for (const name of bad) {
    const next = infer(tsx, name, used);
    mapping.set(name, next);
    used.add(next);
  }
  for (const [from, to] of [...mapping.entries()].sort((a, b) => b[0].length - a[0].length)) {
    css = css.replace(new RegExp(`\\.${from}\\b`, "g"), `.${to}`);
    tsx = tsx.replace(new RegExp(`styles\\.${from}\\b`, "g"), `styles.${to}`);
  }
  fs.writeFileSync(cssPath, css);
  fs.writeFileSync(tsxPath, tsx);
  return mapping.size;
}

let total = 0;
let files = 0;
for (const f of walk("src/components")) {
  if (!f.endsWith(".tsx")) continue;
  if (f.replace(/\\/g, "/").includes("/approval-view/")) continue;
  if (f.replace(/\\/g, "/").includes("/activity-feed/")) continue;
  if (f.replace(/\\/g, "/").endsWith("/button/button.tsx")) continue;
  const css = path.join(path.dirname(f), `${path.basename(f, ".tsx")}.module.css`);
  if (!fs.existsSync(css)) continue;
  const n = processPair(f, css);
  if (n) {
    files++;
    total += n;
    console.log(`OK ${path.relative(".", f)} renamed=${n}`);
  }
}

// audit
let remainFiles = 0;
let remainClasses = 0;
const samples = [];
for (const f of walk("src/components")) {
  if (!f.endsWith(".module.css")) continue;
  const bad = collect(fs.readFileSync(f, "utf8")).filter(needsRename);
  if (bad.length) {
    remainFiles++;
    remainClasses += bad.length;
    if (samples.length < 15) samples.push(`${path.relative(".", f)}: ${bad.slice(0, 6).join(", ")}`);
  }
}
console.log(JSON.stringify({ files, total, remainFiles, remainClasses, samples }, null, 2));
