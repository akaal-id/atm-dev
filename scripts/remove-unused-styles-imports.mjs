/**
 * Remove `import styles from "...module.css"` when `styles` is never referenced.
 */
import fs from "node:fs";
import path from "node:path";

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

const fixed = [];
for (const f of walk("src")) {
  let s = fs.readFileSync(f, "utf8");
  const m = s.match(/^import styles from ["']([^"']+\.module\.css)["'];\r?\n/m);
  if (!m) continue;
  // count styles. usages excluding the import line
  const withoutImport = s.replace(m[0], "");
  if (!/\bstyles\b/.test(withoutImport)) {
    s = s.replace(m[0], "");
    // tidy double blank lines after use client
    s = s.replace(/("use client";)\n{3,}/, "$1\n\n");
    fs.writeFileSync(f, s);
    fixed.push(path.relative(".", f) + " (removed " + m[1] + ")");
  }
}
console.log(fixed.length ? fixed.join("\n") : "none");
console.log("FIXED", fixed.length);
