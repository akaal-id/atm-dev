import fs from "node:fs";
import path from "node:path";

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const f of walk("src")) {
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("type=styles.hidden")) continue;
  s = s.replaceAll("type=styles.hidden", 'type="hidden"');
  fs.writeFileSync(f, s);
  n++;
  console.log("fixed hidden", f);
}
console.log("hidden fixes", n);

// login-form: merge login route form styles + single import
{
  const loginCss = fs.readFileSync("src/app/login/login.module.css", "utf8");
  const existing = fs.readFileSync("src/components/app/login-form/login-form.module.css", "utf8");
  fs.writeFileSync("src/components/app/login-form/login-form.module.css", `${loginCss}\n${existing}`);
  let tsx = fs.readFileSync("src/components/app/login-form/login-form.tsx", "utf8");
  tsx = tsx.replace(/^import styles from ["'].*?["'];\r?\n/gm, "");
  if (!tsx.includes('"use client"')) {
    tsx = `"use client";\n\nimport styles from "./login-form.module.css";\n${tsx}`;
  } else {
    tsx = tsx.replace(/"use client";\r?\n/, `"use client";\n\nimport styles from "./login-form.module.css";\n`);
  }
  fs.writeFileSync("src/components/app/login-form/login-form.tsx", tsx);
  console.log("login-form fixed");
}

// not-found-view: own copy of tenant-notice styles
{
  const tn = fs.readFileSync("src/app/tenant-notice.module.css", "utf8");
  const existing = fs.readFileSync("src/components/app/not-found-view/not-found-view.module.css", "utf8");
  fs.writeFileSync("src/components/app/not-found-view/not-found-view.module.css", `${tn}\n${existing}`);
  let tsx = fs.readFileSync("src/components/app/not-found-view/not-found-view.tsx", "utf8");
  tsx = tsx.replace(/^import styles from ["'].*?["'];\r?\n/gm, "");
  tsx = `import styles from "./not-found-view.module.css";\n${tsx}`;
  fs.writeFileSync("src/components/app/not-found-view/not-found-view.tsx", tsx);
  console.log("not-found-view fixed");
}

// Fix duplicate styles imports anywhere
for (const f of walk("src/components")) {
  if (!f.endsWith(".tsx")) continue;
  let s = fs.readFileSync(f, "utf8");
  const lines = s.split(/\r?\n/);
  let seen = false;
  let changed = false;
  const out = [];
  for (const line of lines) {
    if (/^import styles from /.test(line)) {
      if (seen) {
        changed = true;
        continue;
      }
      seen = true;
    }
    out.push(line);
  }
  if (changed) {
    fs.writeFileSync(f, out.join("\n"));
    console.log("deduped styles import", f);
  }
}
