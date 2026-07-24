/**
 * Build explicit task → workflow map from live Tasks/Projects.
 * Run: node scripts/build-workflow-task-map.mjs
 */
import fs from "node:fs";
import path from "node:path";

const env = fs.readFileSync(path.resolve(".env.local"), "utf8");
function get(key) {
  const match = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const url = (get("NEXT_PUBLIC_SUPABASE_URL") || get("SUPABASE_URL")).replace(/\/$/, "");
const key = get("SUPABASE_SERVICE_ROLE_KEY") || get("SUPABASE_SECRET_KEY");
if (!url || !key) {
  console.error("Missing Supabase URL or service role key");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function fetchAll(table, select) {
  const rows = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${page}&offset=${from}`, {
      headers: { ...headers, Prefer: "count=exact" },
    });
    const chunk = await res.json();
    if (!Array.isArray(chunk)) throw new Error(JSON.stringify(chunk));
    rows.push(...chunk);
    if (chunk.length < page) break;
    from += page;
  }
  return rows;
}

const projects = await fetchAll("projects", "project_id,project_name,ticket_id_prefix");
const tasks = await fetchAll("tasks", "task_id,title,project_id");
const projectById = Object.fromEntries(projects.map((p) => [p.project_id, p]));

const HEI_PROJECT = "prj_c42905a8";
const websiteRe = /website|\[web\b|web hei|halal expo indonesia - website|akaal website|akaal web\b|portfolio.*(?:web|akaal web)|for akaal web|frontend|front end|fe\b|cms design|newsroom/i;
const contentRe = /content|konten|carousel|sosmed|social media|reels|feed|story|visual|branding|photos|shots/i;
const offeringRe = /offering deck|pitch research/i;
const productRe = /\bATM\b|edit task/i;
const testRe = /^test$|ngetest/i;

/** @type {Record<string, string>} */
const map = {};

function assign(taskId, workflowId) {
  map[taskId] = workflowId;
}

for (const task of tasks) {
  const title = String(task.title || "");
  const project = projectById[task.project_id] || null;
  const prefix = project?.ticket_id_prefix || "";
  const projectId = task.project_id || "";

  // --- HEI: website vs sosmed/others ---
  if (projectId === HEI_PROJECT || prefix === "HEI") {
    assign(task.task_id, websiteRe.test(title) ? "wf_hei_website" : "wf_hei_sosmed");
    continue;
  }

  // --- Client web delivery (small projects, all web) ---
  if (prefix === "BFR" || projectId === "prj_93b29f9d") {
    assign(task.task_id, "wf_bfriends_web");
    continue;
  }
  if (prefix === "BNST" || projectId === "prj_2698319f") {
    assign(task.task_id, "wf_bnesta_web");
    continue;
  }
  if (prefix === "SLTX" || projectId === "prj_14ed2750") {
    assign(task.task_id, "wf_selatox_web");
    continue;
  }

  // --- AKAAL-ID (sales / offering) ---
  if (prefix === "AKL" || projectId === "prj_33d5fb6f") {
    assign(task.task_id, offeringRe.test(title) || /deck/i.test(title) ? "wf_akaal_id_offering" : "wf_akaal_id_offering");
    continue;
  }

  // --- Akaal Creative ---
  if (prefix === "AKL-C" || projectId === "prj_f6e94f46") {
    if (websiteRe.test(title) || /portfolio/i.test(title)) {
      assign(task.task_id, "wf_akaal_creative_portfolio");
    } else if (offeringRe.test(title) || /annual report/i.test(title)) {
      assign(task.task_id, "wf_akaal_creative_portfolio");
    } else {
      assign(task.task_id, "wf_akaal_creative_content");
    }
    continue;
  }

  // --- Akaal Studio (content production) ---
  if (prefix === "AKL-S" || projectId === "prj_b3e857e9") {
    assign(task.task_id, "wf_akaal_studio_content");
    continue;
  }

  // --- Akaal Labs ---
  if (prefix === "AKL-L" || projectId === "prj_9dcd3c71") {
    if (testRe.test(title.trim())) {
      assign(task.task_id, "wf_akaal_labs_misc");
    } else if (productRe.test(title)) {
      assign(task.task_id, "wf_akaal_labs_product");
    } else if (websiteRe.test(title)) {
      assign(task.task_id, "wf_akaal_labs_website");
    } else if (contentRe.test(title)) {
      assign(task.task_id, "wf_akaal_labs_content");
    } else {
      assign(task.task_id, "wf_akaal_labs_misc");
    }
    continue;
  }

  // --- orphan / unknown (use task_id prefix as fallback) ---
  const idPrefix = String(task.task_id || "").split("-").slice(0, 2).join("-");
  if (String(task.task_id || "").startsWith("AKL-C-") || idPrefix === "AKL-C") {
    if (websiteRe.test(title) || /portfolio|pricelist|strategy deck|annual report|offering/i.test(title)) {
      assign(task.task_id, "wf_akaal_creative_portfolio");
    } else {
      assign(task.task_id, "wf_akaal_creative_content");
    }
    continue;
  }
  if (String(task.task_id || "").startsWith("AKL-L-") || String(task.task_id || "").startsWith("AKL-")) {
    // rare orphans
    if (offeringRe.test(title) || /deck/i.test(title)) assign(task.task_id, "wf_akaal_id_offering");
    else if (websiteRe.test(title)) assign(task.task_id, "wf_akaal_labs_website");
    else if (contentRe.test(title)) assign(task.task_id, "wf_akaal_labs_content");
    else assign(task.task_id, "wf_unassigned");
    continue;
  }

  assign(task.task_id, "wf_unassigned");
}

const counts = {};
for (const id of Object.values(map)) counts[id] = (counts[id] || 0) + 1;

const outJson = path.resolve("src/lib/data/workflow-task-map.json");
const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(outJson, `${JSON.stringify(sorted, null, 2)}\n`);

console.log(`mapped ${Object.keys(map).length} / ${tasks.length} tasks`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}\t${k}`).join("\n"));
console.log(`wrote ${outJson}`);
