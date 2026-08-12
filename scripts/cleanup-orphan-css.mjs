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

const orphans = [
  "src/components/ui/modal-portal/modal-portal.module.css",
  "src/components/app/email-blast/email-blast-history-loader/email-blast-history-loader.module.css",
  "src/components/app/email-blast/email-blast-status-badge/email-blast-status-badge.module.css",
];

const allSource = walk("src").filter((f) => /\.(tsx|ts)$/.test(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");

for (const o of orphans) {
  if (!fs.existsSync(o)) continue;
  const base = path.basename(o);
  if (allSource.includes(base) || allSource.includes(`./${base}`) || allSource.includes(o.replace(/\\/g, "/"))) {
    console.log("keep", o);
  } else {
    fs.unlinkSync(o);
    console.log("deleted", o);
  }
}

// verify use client order
const bad = [];
for (const f of walk("src").filter((x) => x.endsWith(".tsx"))) {
  const s = fs.readFileSync(f, "utf8");
  const i = s.search(/["']use client["']/);
  if (i <= 0) continue;
  const before = s.slice(0, i).trim();
  if (before && !before.startsWith("//") && !before.startsWith("/*")) {
    bad.push(path.relative(".", f));
  }
}
console.log("use-client-order-bad:", bad.length ? bad.join(", ") : "none");
