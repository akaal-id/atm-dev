/**
 * Strip accidental "Undefined" suffixes and a few other garbled patterns
 * from CSS module class names across src/components.
 */
import fs from "node:fs";
import path from "node:path";

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

function desired(name) {
  let n = name;
  n = n.replace(/Undefined$/g, "");
  const fixes = {
    buttonButton: "rowButton",
    filterbarDiv: "listBody",
    spanidle: "idle",
    pointereventsnone: "noPointer",
    pointereventsauto: "autoPointer",
    halamanSebelumnya: "prevPage",
    pagination: "paginationRoot",
    deliveryFailed: "failedNote",
    cancelUpload: "cancelButton",
    closeConfirmation: "closeButton",
    attachFile: "attachButton",
    sendMessage: "sendButton",
    dataView: "viewRoot",
    cell: "tableCell",
    revealDelay: "revealDelay",
    orb: "orb",
  };
  if (fixes[n]) n = fixes[n];
  if (!n) n = "region";
  // ensure camelCase start lower
  n = n[0].toLowerCase() + n.slice(1);
  return n;
}

const pairs = [];
for (const f of walk("src/components")) {
  if (!f.endsWith(".tsx")) continue;
  const css = path.join(path.dirname(f), `${path.basename(f, ".tsx")}.module.css`);
  if (!fs.existsSync(css)) continue;
  pairs.push([f, css]);
}

let files = 0;
let total = 0;
for (const [tsxPath, cssPath] of pairs) {
  let css = fs.readFileSync(cssPath, "utf8");
  let tsx = fs.readFileSync(tsxPath, "utf8");
  const names = collect(css);
  const bad = names.filter(
    (n) =>
      /Undefined/.test(n) ||
      /^(buttonButton|filterbarDiv|spanidle|pointereventsnone|pointereventsauto)$/i.test(n),
  );
  if (!bad.length) continue;

  const used = new Set(names.filter((n) => !bad.includes(n)));
  const mapping = new Map();
  for (const from of bad) {
    let to = desired(from);
    if (used.has(to) || mapping.has(to)) {
      let i = 2;
      while (used.has(`${to}${i}`) || [...mapping.values()].includes(`${to}${i}`)) i++;
      // prefer word suffix over digit
      const alts = ["Alt", "Secondary", "Aside", "Inner"];
      let found = null;
      for (const a of alts) {
        const cand = to + a;
        if (!used.has(cand) && ![...mapping.values()].includes(cand)) {
          found = cand;
          break;
        }
      }
      to = found || `${to}Alt`;
    }
    mapping.set(from, to);
    used.add(to);
  }

  for (const [from, to] of [...mapping.entries()].sort((a, b) => b[0].length - a[0].length)) {
    css = css.replace(new RegExp(`\\.${from}\\b`, "g"), `.${to}`);
    tsx = tsx.replace(new RegExp(`styles\\.${from}\\b`, "g"), `styles.${to}`);
  }
  fs.writeFileSync(cssPath, css);
  fs.writeFileSync(tsxPath, tsx);
  files++;
  total += mapping.size;
  console.log(`OK ${path.relative(".", tsxPath)} ${[...mapping.entries()].map(([a, b]) => `${a}->${b}`).join(", ")}`);
}

console.log(JSON.stringify({ files, total }, null, 2));
