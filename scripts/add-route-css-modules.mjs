/**
 * Add <segment>.module.css + wire import/wrapper for every page.tsx under src/app.
 */
import fs from "node:fs";
import path from "node:path";

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "api") continue;
      walk(p, acc);
    } else if (e.name === "page.tsx") acc.push(p);
  }
  return acc;
}

function segmentName(pagePath) {
  const dir = path.dirname(pagePath);
  let seg = path.basename(dir);
  if (seg.startsWith("(") && seg.endsWith(")")) {
    seg = path.basename(path.dirname(dir));
  }
  if (seg.startsWith("[") && seg.endsWith("]")) {
    seg = seg.replace(/^\[|\]$/g, "").replace(/^\.\.\./, "") || "detail";
  }
  if (path.resolve(dir) === path.resolve("src/app")) seg = "home";
  return seg;
}

const CSS = `/* Route section styles — plain CSS, no @apply */
.page {
  min-width: 0;
  width: 100%;
  max-width: 100%;
}
`;

function wrapReturns(src) {
  if (src.includes("styles.page")) return src;

  // return (<Thing ... />);  multi or single line
  src = src.replace(/return\s*\(\s*\n(\s*)(<[\s\S]*?>)\s*\n(\s*)\);/g, (m, ind, jsx, ind2) => {
    if (jsx.includes("styles.page") || jsx.includes("className={styles.")) return m;
    return `return (\n${ind}<div className={styles.page}>\n${ind}  ${jsx}\n${ind}</div>\n${ind2});`;
  });

  // return <Thing ... />;
  src = src.replace(/return\s+(<[A-Za-z][^;]*\/>);/g, (m, jsx) => {
    if (jsx.includes("styles.page")) return m;
    return `return (\n    <div className={styles.page}>\n      ${jsx}\n    </div>\n  );`;
  });

  // return <Thing>...</Thing>;
  src = src.replace(/return\s+(<[A-Za-z][\s\S]*?<\/[A-Za-z0-9]+>);/g, (m, jsx) => {
    if (jsx.includes("styles.page") || m.includes("styles.page")) return m;
    // only if relatively short (thin pages)
    if (jsx.length > 800) return m;
    return `return (\n    <div className={styles.page}>\n      ${jsx}\n    </div>\n  );`;
  });

  return src;
}

const pages = walk("src/app");
let added = 0;
let skipped = 0;
let wired = 0;

for (const pagePath of pages) {
  const dir = path.dirname(pagePath);
  const seg = segmentName(pagePath);
  const cssName = `${seg}.module.css`;
  const cssPath = path.join(dir, cssName);
  let src = fs.readFileSync(pagePath, "utf8");

  const importsLocalModule = /from\s+["'](\.\/|\.\.\/)[^"']+\.module\.css["']/.test(src);

  if (importsLocalModule) {
    // ensure segment css exists only if none
    const existing = fs.readdirSync(dir).filter((f) => f.endsWith(".module.css"));
    if (!existing.length && !fs.existsSync(cssPath)) {
      fs.writeFileSync(cssPath, CSS, "utf8");
      added++;
    }
    skipped++;
    console.log("skip (has css import)", pagePath);
    continue;
  }

  if (!fs.existsSync(cssPath)) {
    fs.writeFileSync(cssPath, CSS, "utf8");
    added++;
  }

  if (!src.includes(`./${cssName}`)) {
    if (/^["']use client["'];/.test(src)) {
      src = src.replace(/^(["']use client["'];\r?\n)/, `$1\nimport styles from "./${cssName}";\n`);
    } else {
      src = `import styles from "./${cssName}";\n${src}`;
    }
  }

  src = wrapReturns(src);
  fs.writeFileSync(pagePath, src, "utf8");
  wired++;
  console.log("wired", path.relative(".", pagePath), "->", cssName);
}

console.log(JSON.stringify({ added, skipped, wired, total: pages.length }, null, 2));
