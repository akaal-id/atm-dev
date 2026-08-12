import fs from "node:fs";
import path from "node:path";

function replaceImport(file, from, to) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes(from)) {
    console.log("skip (no match)", file);
    return;
  }
  s = s.replace(from, to);
  fs.writeFileSync(file, s);
  console.log("updated", file);
}

fs.copyFileSync("src/app/signup/signup.module.css", "src/app/verify/verify.module.css");
replaceImport(
  "src/app/verify/page.tsx",
  'import styles from "../signup/signup.module.css";',
  'import styles from "./verify.module.css";',
);

fs.copyFileSync("src/app/tenant-notice.module.css", "src/app/tenant-access-denied/tenant-access-denied.module.css");
replaceImport(
  "src/app/tenant-access-denied/page.tsx",
  'import styles from "../tenant-notice.module.css";',
  'import styles from "./tenant-access-denied.module.css";',
);

fs.copyFileSync("src/app/signup/signup.module.css", "src/app/signup/organization/organization.module.css");
replaceImport(
  "src/app/signup/organization/page.tsx",
  'import styles from "../signup.module.css";',
  'import styles from "./organization.module.css";',
);

fs.copyFileSync("src/app/signup/signup.module.css", "src/app/signup/requested/requested.module.css");
replaceImport(
  "src/app/signup/requested/page.tsx",
  'import styles from "../signup.module.css";',
  'import styles from "./requested.module.css";',
);

// Delete unused app-level hub.css
if (fs.existsSync("src/app/hub.module.css")) {
  const hubPage = fs.readFileSync("src/components/hub/hub-page/hub-page.tsx", "utf8");
  if (!hubPage.includes("@/app/hub.module.css")) {
    fs.unlinkSync("src/app/hub.module.css");
    console.log("deleted src/app/hub.module.css");
  }
}

// Delete tenant-notice if unused
function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const still = walk("src").filter((p) => fs.readFileSync(p, "utf8").includes("tenant-notice.module.css"));
if (!still.length && fs.existsSync("src/app/tenant-notice.module.css")) {
  fs.unlinkSync("src/app/tenant-notice.module.css");
  console.log("deleted src/app/tenant-notice.module.css");
} else {
  console.log("tenant-notice still referenced by", still);
}
