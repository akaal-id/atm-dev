import fs from "node:fs";
import path from "node:path";

function isLeftover(name) {
  if (/^(row|stack|grid|body|meta|text|button|link|item|list|form|label|input|title|heading|icon|panel|wrap|group|slot|marker|filter|content|toolbar|action|empty|region|section|caption|control|layout|active|badge|hint|card|code|select|spinner|actions|header|footer|nav|main|fieldLabel|emptyText|errorText|emptyState|modalPanel|filterGroup|cluster|columns|surface|glyph|block|dialogPanel|filterBar|sectionBody|sectionTitle|control|surface|glyph|block|cluster|columns)\d+$/i.test(name))
    return true;
  if (/^(slot|filtergroup|fieldlabel|flexrow|flexrowreverse|mtauto|minwfull)$/i.test(name)) return true;
  if (/^(flex|spacey|spacex|textsm|textxs|textbase|rounded)[a-z0-9]*$/i.test(name)) return true;
  if (/^(mt|mb|ml|mr|mx|my|px|py|pt|pb|minw|maxw)[a-z0-9]+$/i.test(name) && !/^(meta|text)$/i.test(name)) return true;
  return false;
}

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, a);
    else if (e.name.endsWith(".module.css")) a.push(p);
  }
  return a;
}

let files = 0;
let classes = 0;
const samples = [];
for (const f of walk("src/components")) {
  const bad = [...new Set([...fs.readFileSync(f, "utf8").matchAll(/\.([A-Za-z_][\w]*)\b/g)].map((m) => m[1]).filter(isLeftover))];
  if (bad.length) {
    files++;
    classes += bad.length;
    if (samples.length < 20) samples.push(`${path.relative(".", f)}: ${bad.slice(0, 8).join(", ")}`);
  }
}
console.log(JSON.stringify({ files, classes, samples }, null, 2));
