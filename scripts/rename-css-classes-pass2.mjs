/**
 * Pass 2 (safe): only rename numbered leftovers (row2, body3, button2, slot, marker…)
 * Never touch plain semantic names like button, layout, panel, meta, title.
 */
import fs from "node:fs";
import path from "node:path";

function isLeftover(name) {
  if (!name) return false;
  // numbered generics only
  if (/^(row|stack|grid|body|meta|text|button|link|item|list|form|label|input|title|heading|icon|panel|wrap|group|slot|marker|filter|content|toolbar|action|empty|region|section|caption|control|layout|active|badge|hint|card|code|select|spinner|actions|header|footer|nav|main|fieldLabel|emptyText|errorText|emptyState|modalPanel|filterGroup|filterBar|filterbar|dialogPanel|dialogpanel|itemDescription|itemMeta|itemBody|showMore|statusTab|checkBox|subheading|description|cluster|columns|surface|glyph|block|idle|pushEnd|fullWidth|rowReverse|sectionBody|sectionTitle|mlauto|mxauto|mtauto)\d+$/i.test(name))
    return true;
  // only these bare auto names (never button/layout/panel/meta/emptyState alone)
  if (/^(slot|filtergroup|fieldlabel|flexrow|flexrowreverse|mtauto|minwfull|mlauto|mxauto)$/i.test(name)) return true;
  // names that still end with digits after a generic stem
  if (/[a-z]\d+$/i.test(name) && /^(filter|dialog|empty|section|field|control|caption|glyph|block|cluster|surface|header|body|text|icon|label|input|button)/i.test(name))
    return true;
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

function toName(base) {
  let name = String(base)
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
  if (!name || /^\d/.test(name)) name = "region";
  return name;
}

function unique(base, used, hints = []) {
  const name = toName(base);
  if (!used.has(name) && !isLeftover(name)) return name;
  const suffixes = [
    ...hints.map(toName).filter(Boolean),
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
    "Foot",
    "Head",
  ];
  for (const s of suffixes) {
    const alt = name + s.charAt(0).toUpperCase() + s.slice(1);
    if (!used.has(alt) && !isLeftover(alt)) return alt;
  }
  let i = 2;
  while (used.has(`${name}Variant${i}`) || isLeftover(`${name}Variant${i}`)) i++;
  return `${name}Variant${i}`;
}

function infer(tsx, className, used) {
  const idx = tsx.search(new RegExp(`styles\\.${className}\\b`));
  if (idx < 0) return unique(className.replace(/\d+$/, "") || "region", used);
  const before = tsx.slice(Math.max(0, idx - 320), idx);
  const after = tsx.slice(idx, Math.min(tsx.length, idx + 180));
  const window = before + after;

  const fn = [...before.matchAll(/(?:function|const)\s+([A-Z][A-Za-z0-9]*)/g)].pop()?.[1] || "";
  const comment = [...before.matchAll(/\{\/\*\s*([^*]+?)\s*\*\/\}/g)].pop()?.[1];
  const aria = before.match(/aria-label=["']([^"']+)["']/)?.[1];
  const nameAttr = before.match(/\bname=["']([^"']+)["']/)?.[1];
  const tag = before.match(/<([A-Za-z][\w.]*)[^<]*$/)?.[1]?.split(".").pop() || "";
  const hints = [fn, comment, aria, nameAttr, tag].filter(Boolean);

  if (comment) return unique(comment, used, hints);
  if (aria) return unique(aria, used, hints);

  if (/isActive|selected/.test(before.slice(-100)) && /\?/.test(window)) {
    if (new RegExp(`\\?\\s*styles\\.${className}`).test(tsx)) return unique("active", used, hints);
    if (new RegExp(`:\\s*styles\\.${className}`).test(tsx)) return unique("idle", used, hints);
  }

  if (/select/i.test(tag)) return unique("select", used, hints);
  if (/button/i.test(tag)) return unique("button", used, hints);
  if (/h1/i.test(tag)) return unique("title", used, hints);
  if (/h2/i.test(tag)) return unique("heading", used, hints);
  if (/h3/i.test(tag)) return unique("subheading", used, hints);
  if (/code/i.test(tag)) return unique("code", used, hints);
  if (/article/i.test(tag)) return unique("card", used, hints);
  if (/form/i.test(tag)) return unique("form", used, hints);
  if (/table/i.test(tag)) return unique("table", used, hints);
  if (/label/i.test(tag)) return unique(nameAttr ? `${nameAttr}Label` : "label", used, hints);
  if (/input|textarea/i.test(tag)) return unique(nameAttr ? `${nameAttr}Input` : "input", used, hints);
  if (/span/i.test(tag)) return unique(/count|badge/i.test(window) ? "badge" : "caption", used, hints);
  if (/^p$/i.test(tag)) return unique(/empty|No /i.test(after) ? "emptyText" : "text", used, hints);
  if (/Link|^a$/i.test(tag)) return unique("link", used, hints);
  if (/Loader/i.test(tag)) return unique("spinner", used, hints);
  if (/Icon|Check|Layers|Alert|Clock|Mail|Plus|Chevron|Pencil|Shield|Sparkles/i.test(tag))
    return unique("icon", used, hints);

  if (/\.map\s*\(/.test(before.slice(-80))) return unique("item", used, hints);
  if (/CardBody/.test(before)) return unique("body", used, hints);
  if (/empty|Empty/.test(window)) return unique("emptyState", used, hints);
  if (/modal|dialog|Dialog|Modal/.test(window)) return unique("dialogPanel", used, hints);
  if (/sidebar|Sidebar|room list|RoomList/i.test(window)) return unique("sidebar", used, hints);
  if (/filter|tab|Tab/.test(window)) return unique("filterBar", used, hints);

  if (/mlauto|mr-auto|ml-auto/i.test(className)) return unique("pushEnd", used, hints);
  if (/minwfull|min-w-full|w-full/i.test(className)) return unique("fullWidth", used, hints);
  if (/flexrowreverse|row-reverse/i.test(className)) return unique("rowReverse", used, hints);
  if (/flexrow/i.test(className)) return unique("row", used, hints);

  if (/^grid|^columns/i.test(className)) return unique("columns", used, hints);
  if (/^row|^stack|^flex|^cluster/i.test(className)) return unique("cluster", used, hints);
  if (/^body|^sectionBody/i.test(className)) return unique("sectionBody", used, hints);
  if (/^title|^sectionTitle|^heading/i.test(className)) return unique("sectionTitle", used, hints);
  if (/^meta|^caption|^text/i.test(className)) return unique("caption", used, hints);
  if (/^icon|^marker|^glyph/i.test(className)) return unique("icon", used, hints);
  if (/^button|^control/i.test(className)) return unique("button", used, hints);
  if (/^slot|^surface|^panel|^block|^region/i.test(className)) return unique("surface", used, hints);
  if (/^filter/i.test(className)) return unique("filterBar", used, hints);
  if (/^label/i.test(className)) return unique("label", used, hints);
  if (/^input/i.test(className)) return unique("input", used, hints);
  if (/^dialog/i.test(className)) return unique("dialogPanel", used, hints);
  if (/^header/i.test(className)) return unique("header", used, hints);
  if (/^empty/i.test(className)) return unique("emptyState", used, hints);

  return unique(fn ? `${fn}Region` : "region", used, hints);
}

function processPair(tsxPath, cssPath) {
  let tsx = fs.readFileSync(tsxPath, "utf8");
  let css = fs.readFileSync(cssPath, "utf8");
  const leftovers = collect(css).filter(isLeftover);
  if (!leftovers.length) return 0;

  const used = new Set(collect(css).filter((c) => !isLeftover(c)));
  const mapping = new Map();
  for (const name of leftovers) {
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

const pairs = [];
for (const f of walk("src/components")) {
  if (!f.endsWith(".tsx")) continue;
  if (f.replace(/\\/g, "/").includes("/approval-view/")) continue;
  if (f.replace(/\\/g, "/").includes("/activity-feed/")) continue;
  if (f.replace(/\\/g, "/").endsWith("/button/button.tsx")) continue;
  const css = path.join(path.dirname(f), `${path.basename(f, ".tsx")}.module.css`);
  if (fs.existsSync(css)) pairs.push([f, css]);
}

let total = 0;
let files = 0;
for (const [tsx, css] of pairs) {
  const n = processPair(tsx, css);
  if (n) {
    files++;
    total += n;
    console.log(`OK ${path.relative(".", tsx)} renamed=${n}`);
  }
}

let remain = 0;
for (const [, css] of pairs) remain += collect(fs.readFileSync(css, "utf8")).filter(isLeftover).length;
console.log(JSON.stringify({ files, total, remain }, null, 2));
