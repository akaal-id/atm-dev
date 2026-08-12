/**
 * Ensure "use client" is the first statement in every file that has it.
 * Moves styles/other imports below the directive.
 */
import fs from "node:fs";
import path from "node:path";

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function fixFile(file) {
  let src = fs.readFileSync(file, "utf8");
  if (!/["']use client["']/.test(src)) return false;

  // Already correct: first non-empty/non-comment line is use client
  const stripped = src.replace(/^\uFEFF/, "");
  const lines = stripped.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === "" || t.startsWith("//")) {
      i++;
      continue;
    }
    if (t.startsWith("/*")) {
      // skip block comment
      while (i < lines.length && !lines[i].includes("*/")) i++;
      i++;
      continue;
    }
    break;
  }
  if (i < lines.length && /^["']use client["'];?\s*$/.test(lines[i].trim())) {
    return false;
  }

  // Extract use client line
  const m = stripped.match(/^[\s\S]*?(["']use client["'];?)([\s\S]*)$/);
  if (!m) return false;

  // Remove all use client occurrences, then prepend
  let body = stripped.replace(/^\s*["']use client["'];?\s*\r?\n/gm, "");
  body = body.replace(/\r?\n\s*["']use client["'];?\s*/g, "\n");
  body = body.replace(/^\uFEFF/, "");
  // Ensure single leading newline after directive
  const next = `"use client";\n\n${body.replace(/^\s*\n+/, "")}`;
  if (next === stripped || next === src) return false;
  fs.writeFileSync(file, next);
  return true;
}

const fixed = [];
for (const f of walk("src")) {
  if (fixFile(f)) fixed.push(path.relative(".", f));
}
console.log(fixed.length ? fixed.join("\n") : "none");
console.log("FIXED", fixed.length);
