import fs from "node:fs";

const map = JSON.parse(fs.readFileSync("./src/lib/data/workflow-task-map.json", "utf8"));
const entries = Object.entries(map);

function esc(value) {
  return String(value).replaceAll("'", "''");
}

for (let i = 0; i < 4; i += 1) {
  const slice = entries.slice(i * 53, (i + 1) * 53);
  const values = slice.map(([taskId, workflowId]) => `('${esc(taskId)}', '${esc(workflowId)}')`).join(",\n");
  const sql = `update public.tasks t
set workflow_id = m.workflow_id
from (values
${values}
) as m(task_id, workflow_id)
where t.task_id = m.task_id
  and coalesce(t.workflow_id, '') = '';`;
  fs.writeFileSync(`./tmp-backfill-batch-${i}.sql`, sql);
  console.log(i, slice.length, sql.length);
}
