import fs from "node:fs";

const map = JSON.parse(fs.readFileSync("./src/lib/data/workflow-task-map.json", "utf8"));

function esc(value) {
  return String(value).replaceAll("'", "''");
}

const updates = Object.entries(map).map(
  ([taskId, wfId]) =>
    `update public.tasks set workflow_id = '${esc(wfId)}' where task_id = '${esc(taskId)}' and coalesce(workflow_id, '') = '';`,
);

fs.writeFileSync("./tmp-backfill-workflow-ids.sql", updates.join("\n"));
console.log("backfill statements", updates.length);
