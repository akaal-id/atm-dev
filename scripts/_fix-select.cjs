const fs = require("fs");
const path = require("path");

const folders = [
  "date-picker-field","date-range-picker-field","filter-select","form-select","input",
  "linkified-text","modal-portal","modal","pagination","popover","select","status-pill","toast"
].map((n) => path.join("src/components/ui", n));
folders.push("src/components/hub/hub-page");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const slotMap = {
  selectgroup: "select-group",
  selectvalue: "select-value",
  selecttrigger: "select-trigger",
  selectcontent: "select-content",
  selectlabel: "select-label",
  selectitem: "select-item",
  selectseparator: "select-separator",
  selectscrollupbutton: "select-scroll-up-button",
  selectscrolldownbutton: "select-scroll-down-button",
};

for (const folder of folders) {
  for (const file of walk(folder)) {
    let src = fs.readFileSync(file, "utf8");
    const before = src;

    // Fix unquoted data-slot=styles.foo
    src = src.replace(/data-slot=styles\.([A-Za-z0-9_]+)/g, (m, key) => {
      const val = slotMap[key] || key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
      // prefer known map; otherwise try kebab from key by inserting hyphens before known words is hard
      const mapped = slotMap[key];
      if (mapped) return `data-slot="${mapped}"`;
      // fallback: keep key as-is with hyphens for common patterns
      console.log("UNKNOWN data-slot key", key, "in", file);
      return `data-slot="${key}"`;
    });

    // Fix [class*=styles.size] artifacts from [class*='size-']
    src = src.replace(/\[class\*=styles\.size\]/g, "[class*='size-']");
    src = src.replace(/\[class\*=styles\.([A-Za-z0-9_]+)\]/g, (m, key) => {
      console.log("class*=styles." + key, "in", file);
      return `[class*='${key}-']`;
    });

    // Move "use client" above imports if styles import was prepended
    if (/^import styles from .+\r?\n"use client"/.test(src) || /^import styles from .+\r?\n'use client'/.test(src)) {
      src = src.replace(/^import styles from (.+);\r?\n("use client"|'use client')\r?\n/, '$2\n\nimport styles from $1;\n');
    }

    // type=styles.hidden
    src = src.replace(/type=\{styles\.hidden\}/g, 'type="hidden"');
    src = src.replace(/type=styles\.hidden/g, 'type="hidden"');

    // other unquoted attr=styles.xxx that should be strings (data-* only generally)
    // Fix data-xxx=styles.yyy without braces/quotes
    src = src.replace(/\b(data-[a-zA-Z0-9-]+)=styles\.([A-Za-z0-9_]+)/g, (m, attr, key) => {
      console.log("fixing", attr, key, "in", file);
      const mapped = slotMap[key];
      return `${attr}="${mapped || key}"`;
    });

    if (src !== before) {
      fs.writeFileSync(file, src);
      console.log("updated", file);
    }
  }
}

// Also scan for remaining broken patterns
for (const folder of folders) {
  for (const file of walk(folder)) {
    const src = fs.readFileSync(file, "utf8");
    const bad = [];
    if (/=styles\./.test(src) && !/className=\{?styles\./.test(src.replace(/className=\{cn\([^)]*styles\./g,""))) {
      // crude: find attr=styles.
      const re = /(?<![\w.])(\w+)=styles\.([A-Za-z0-9_]+)/g;
      let m;
      while ((m = re.exec(src))) {
        if (m[1] === "className") continue;
        bad.push(m[0]);
      }
    }
    const re2 = /(\w+)=styles\.([A-Za-z0-9_]+)/g;
    let m2;
    while ((m2 = re2.exec(src))) {
      if (m2[1] === "className") continue;
      bad.push(m2[0]);
    }
    if (bad.length) console.log("REMAINING", file, [...new Set(bad)]);
  }
}
