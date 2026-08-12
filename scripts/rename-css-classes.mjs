/**
 * Rename utility-derived CSS module class names (flex2, textsm, …)
 * to semantic names inferred from JSX usage (title, item, toolbar, …).
 */
import fs from "node:fs";
import path from "node:path";

/** Only auto-generated / utility-shaped names — not intentional semantic or variant names */
function isBadName(name) {
  if (!name || name === "root") return false;
  // intentional button/variant-style names
  if (/^(default|outline|secondary|ghost|destructive|link|success|warning|size)/i.test(name) && !/text|flex|grid|rounded|space|minw|maxw|^h\d|^w\d|^p\d|^m[trblxy]?\d/.test(name)) {
    if (/^(default|outline|secondary|ghost|destructive|destructiveOutline|destructiveSolid|link|success|warning)$/.test(name)) return false;
    if (/^size[A-Z]/.test(name)) return false;
  }
  // classic auto names from migrator
  if (/^(flex|grid|inlineflex|block|hidden|absolute|relative|fixed|sticky)\d*$/i.test(name)) return true;
  if (/^(text|bg|border|rounded|leading|tracking|font|opacity|shadow|overflow|cursor|select|outline|ring|table|aspect|object|inset|z|grow|shrink|animate|transition|snap|place|stroke)[a-z0-9]*\d*$/i.test(name)) return true;
  if (/^(mt|mb|ml|mr|mx|my|pt|pb|pl|pr|px|py|p|w|h|minw|maxw|minh|maxh|gap|size|colspan)\d+[a-z0-9]*$/i.test(name)) return true;
  if (/^(spacey|spacex)\d*$/i.test(name)) return true;
  if (/^(breakwords|truncate|sr|mlauto|mrauto|mxauto|hfull|wfull|minh0|uppercase|lowercase|whitespace|chatprose|tabularnums|lineclamp\d*)$/i.test(name)) return true;
  if (/^(textmutedforeground|textforeground|textprimary|bgmuted|bgcard|bgprimary|bgsurface|bgred|bggreen|bgamber)\d*$/i.test(name)) return true;
  if (/^c\d+$/i.test(name)) return true;
  if (/^el\d+$/i.test(name)) return true;
  // leftover numbered semantics from weak pass
  if (/^(row|stack|grid|body|meta|text|button|link|item|list|form|label|input|title|heading|icon|panel|wrap|group)\d+$/i.test(name)) return true;
  return false;
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function toCamel(parts) {
  const clean = String(parts)
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!clean.length) return null;
  return clean
    .map((w, i) => {
      const lower = w.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function collectCssClasses(css) {
  const set = new Set();
  for (const m of css.matchAll(/\.([A-Za-z_][\w]*)\b/g)) set.add(m[1]);
  return [...set];
}

function findUsages(tsx, className) {
  const re = new RegExp(`styles\\.${className}\\b`, "g");
  const hits = [];
  let m;
  while ((m = re.exec(tsx))) hits.push(m.index);
  return hits;
}

function contextAt(tsx, index) {
  const start = Math.max(0, index - 500);
  const end = Math.min(tsx.length, index + 280);
  const before = tsx.slice(start, index);
  const after = tsx.slice(index, end);

  const fnMatch = [...before.matchAll(/(?:function|const)\s+([A-Z][A-Za-z0-9]*)/g)].pop();
  const fn = fnMatch?.[1] ?? null;

  const tagMatch = before.match(/<([A-Za-z][\w.]*)([^<]*)$/);
  const tag = tagMatch?.[1]?.split(".").pop() ?? null;
  const attrs = tagMatch?.[2] ?? "";

  return {
    fn,
    tag,
    aria: attrs.match(/aria-label=["']([^"']+)["']/)?.[1],
    role: attrs.match(/role=["']([^"']+)["']/)?.[1],
    nameAttr: attrs.match(/\bname=["']([^"']+)["']/)?.[1],
    typeAttr: attrs.match(/\btype=["']([^"']+)["']/)?.[1],
    placeholder: attrs.match(/placeholder=["']([^"']+)["']/)?.[1],
    before,
    after,
  };
}

function unique(base, used) {
  if (!base) base = "slot";
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

function remapped(mapping, used, oldName, desired) {
  const prev = mapping.get(oldName);
  if (prev === desired || (prev && prev.startsWith(desired) && !isBadName(prev) && desired.length < 3)) {
    /* keep */
  }
  if (prev) used.delete(prev);
  const next = unique(desired, used);
  mapping.set(oldName, next);
  used.add(next);
  return next;
}

function suggestFromContext(ctxs) {
  const scores = new Map();
  const add = (name, score) => {
    if (!name || name.length < 2) return;
    const n = toCamel(name);
    if (!n || isBadName(n)) return;
    scores.set(n, Math.max(scores.get(n) || 0, score));
  };

  for (const ctx of ctxs) {
    if (ctx.fn === "SectionTitle" || ctx.fn === "SectionHeading") add("title", 100);
    if (ctx.fn === "EmptyState") add("empty", 100);
    if (ctx.fn === "Field") add("fieldLabel", 80);

    if (ctx.fn) {
      const fn = ctx.fn
        .replace(/(View|Form|Modal|Panel|Card|Section|List|Table|Dialog|Picker)$/g, "")
        .replace(/^(use|handle|on|render)/, "");
      if (fn.length > 2) add(fn, 40);
    }

    if (ctx.aria) add(ctx.aria, 90);
    if (ctx.role === "listbox") add("menu", 90);
    if (ctx.role === "dialog") add("dialog", 90);
    if (ctx.role) add(ctx.role, 70);
    if (ctx.nameAttr) add(`${ctx.nameAttr}Field`, 75);
    if (ctx.placeholder) add(ctx.placeholder.split(/\s+/).slice(0, 3).join(" "), 60);

    const tag = (ctx.tag || "").toLowerCase();
    const tagMap = {
      h1: ["title", 95],
      h2: ["heading", 90],
      h3: ["subheading", 85],
      h4: ["eyebrow", 70],
      p: ["text", 50],
      span: ["meta", 40],
      button: ["button", 70],
      form: ["form", 90],
      nav: ["nav", 95],
      header: ["header", 95],
      footer: ["footer", 95],
      main: ["main", 90],
      section: ["section", 70],
      aside: ["aside", 80],
      ul: ["list", 85],
      ol: ["list", 85],
      li: ["item", 85],
      table: ["table", 95],
      thead: ["tableHead", 90],
      tbody: ["tableBody", 90],
      tr: ["row", 80],
      th: ["headerCell", 80],
      td: ["cell", 75],
      label: ["label", 85],
      input: ["input", 80],
      select: ["select", 80],
      textarea: ["textarea", 80],
      img: ["image", 85],
      a: ["link", 80],
      link: ["link", 80],
      hr: ["divider", 90],
      dialog: ["dialog", 95],
    };
    if (tagMap[tag]) add(tagMap[tag][0], tagMap[tag][1]);

    if (ctx.tag && /^[A-Z]/.test(ctx.tag)) {
      if (/Button/.test(ctx.tag)) add("button", 70);
      else if (/Link/.test(ctx.tag)) add("link", 70);
      else if (/Badge|Pill/.test(ctx.tag)) add("badge", 80);
      else if (/Avatar/.test(ctx.tag)) add("avatar", 80);
      else if (/Input|Select|Field/.test(ctx.tag)) add("field", 75);
      else if (/Card/.test(ctx.tag)) add("card", 60);
      else if (/Modal|Dialog/.test(ctx.tag)) add("modal", 85);
      else if (/Icon|Loader|Check|Plus|X$|Chevron|Layers|Clock|Mail|Alert|Sparkles|Pencil|Shield|Network/.test(ctx.tag))
        add("icon", 85);
      else add(ctx.tag, 45);
    }

    if (/CardBody/.test(ctx.before)) add("body", 85);
    if (/CardHeader/.test(ctx.before)) add("header", 85);
    if (/\.map\s*\(/.test(ctx.before.slice(-100))) add("item", 80);
    if (/Show more|Show less|Load more/i.test(ctx.after + ctx.before)) add("showMore", 95);
    if (/type=["']submit["']/.test(ctx.before.slice(-120))) add("submit", 90);
    if (/filter|Filter|tab|Tab/.test(ctx.before.slice(-200) + ctx.after.slice(0, 80))) add("filter", 55);
    if (/toolbar|Toolbar|actions|Actions/.test(ctx.before.slice(-160))) add("toolbar", 70);
    if (/empty|No |belum|tidak ada/i.test(ctx.after.slice(0, 120))) add("emptyState", 65);

    // self-closing marker
    if (/styles\.\w+\s*\}\s*\/>/.test(ctx.after) || /styles\.\w+\s*\}\s*><\/div>/.test(ctx.after)) add("marker", 90);
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

function renameInCss(css, mapping) {
  const entries = [...mapping.entries()].sort((a, b) => b[0].length - a[0].length);
  let out = css;
  for (const [from, to] of entries) {
    if (from === to) continue;
    out = out.replace(new RegExp(`\\.${from}\\b`, "g"), `.${to}`);
  }
  // drop empty comment-only migration header noise; keep file valid
  return out;
}

function renameInTsx(tsx, mapping) {
  const entries = [...mapping.entries()].sort((a, b) => b[0].length - a[0].length);
  let out = tsx;
  for (const [from, to] of entries) {
    if (from === to) continue;
    out = out.replace(new RegExp(`styles\\.${from}\\b`, "g"), `styles.${to}`);
  }
  // fix styles import after use client
  if (/^import styles from /m.test(out) && /"use client"/.test(out)) {
    const cssImport = out.match(/^import styles from ["']([^"']+)["'];\r?\n/m)?.[0];
    if (cssImport && out.indexOf(cssImport) < out.indexOf('"use client"')) {
      out = out.replace(cssImport, "");
      out = out.replace(/"use client";\r?\n/, `"use client";\n\n${cssImport}`);
    }
  }
  return out;
}

function processPair(tsxPath, cssPath) {
  let tsx = fs.readFileSync(tsxPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  const classes = collectCssClasses(css).filter(isBadName);
  if (!classes.length) return { renamed: 0 };

  const mapping = new Map();
  const used = new Set(collectCssClasses(css).filter((c) => !isBadName(c)));

  // Forced helper-component mappings
  for (const [re, name] of [
    [/function\s+SectionTitle[\s\S]{0,400}?styles\.(\w+)/g, "title"],
    [/function\s+EmptyState[\s\S]{0,400}?styles\.(\w+)/g, "empty"],
    [/function\s+SectionHeading[\s\S]{0,400}?styles\.(\w+)/g, "heading"],
  ]) {
    for (const m of tsx.matchAll(re)) {
      if (classes.includes(m[1]) && !mapping.has(m[1])) remapped(mapping, used, m[1], name);
    }
  }

  for (const className of classes) {
    if (mapping.has(className)) continue;
    const ctxs = findUsages(tsx, className).map((i) => contextAt(tsx, i));
    const suggestions = suggestFromContext(ctxs);

    let chosen = null;
    for (const s of suggestions) {
      if (!used.has(s)) {
        chosen = s;
        break;
      }
    }
    if (!chosen) {
      // fallback by utility shape
      if (/spacey|spacex/i.test(className)) chosen = unique("stack", used);
      else if (/^flex/i.test(className)) chosen = unique("row", used);
      else if (/^grid/i.test(className)) chosen = unique("grid", used);
      else if (/minw0/i.test(className)) chosen = unique("content", used);
      else if (/^h\d/i.test(className)) chosen = unique("icon", used);
      else chosen = unique(suggestions[0] || "slot", used);
    }
    mapping.set(className, chosen);
    used.add(chosen);
  }

  // Structural refinement pass
  for (const [oldName] of [...mapping.entries()]) {
    const ctxs = findUsages(tsx, oldName).map((i) => contextAt(tsx, i));
    if (!ctxs.length) continue;
    const ctx = ctxs[0];
    const cur = mapping.get(oldName);

    if (ctx.fn === "EmptyState") remapped(mapping, used, oldName, "empty");
    else if (ctx.fn === "SectionTitle") remapped(mapping, used, oldName, "title");
    else if (/CardBody/.test(ctx.before) && /spacey|stack|row|grid/i.test(oldName + cur)) remapped(mapping, used, oldName, "body");
    else if (/\.map\s*\(/.test(ctx.before.slice(-120)) && /^(row|stack|flex|grid|item)/i.test(cur + oldName))
      remapped(mapping, used, oldName, "item");
    else if (/styles\.(item|row)\b/.test(ctx.before) && /minw|content|body/i.test(oldName + cur))
      remapped(mapping, used, oldName, "itemBody");
    else if (/<(p)\b/i.test(ctx.before.slice(-50))) {
      if (/formatDate|created_at|userName|user_id/.test(ctx.after + ctx.before)) remapped(mapping, used, oldName, "itemMeta");
      else if (/description|log\.|children|label/.test(ctx.after + ctx.before) || /breakwords|truncate/i.test(oldName))
        remapped(mapping, used, oldName, "itemDescription");
    } else if (/Show more|Show less/i.test(ctx.after + ctx.before)) remapped(mapping, used, oldName, "showMore");
    else if (/styles\.\w+\s*\}\s*\/>/.test(ctx.after)) remapped(mapping, used, oldName, "marker");
  }

  fs.writeFileSync(cssPath, renameInCss(css, mapping));
  fs.writeFileSync(tsxPath, renameInTsx(tsx, mapping));
  return { renamed: mapping.size };
}

function findPairs(roots) {
  const pairs = [];
  for (const root of roots) {
    for (const f of walk(root)) {
      if (!f.endsWith(".tsx")) continue;
      // skip button variants file — names are intentional
      if (f.replace(/\\/g, "/").endsWith("/button/button.tsx")) continue;
      const dir = path.dirname(f);
      const base = path.basename(f, ".tsx");
      const css = path.join(dir, `${base}.module.css`);
      if (fs.existsSync(css)) pairs.push([f, css]);
    }
  }
  return pairs;
}

const args = process.argv.slice(2);
const roots = args.length ? args : ["src/components"];
const pairs = findPairs(roots);

let total = 0;
let files = 0;
for (const [tsx, css] of pairs) {
  const bad = collectCssClasses(fs.readFileSync(css, "utf8")).filter(isBadName);
  if (!bad.length) continue;
  const result = processPair(tsx, css);
  if (result.renamed) {
    files++;
    total += result.renamed;
    console.log(`OK ${path.relative(".", tsx)} renamed=${result.renamed}`);
  }
}
console.log(JSON.stringify({ files, total }, null, 2));

// report remaining bad names
let remainFiles = 0;
let remainClasses = 0;
for (const [, css] of pairs) {
  const bad = collectCssClasses(fs.readFileSync(css, "utf8")).filter(isBadName);
  if (bad.length) {
    remainFiles++;
    remainClasses += bad.length;
  }
}
console.log(JSON.stringify({ remainFiles, remainClasses }, null, 2));
