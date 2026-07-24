import fs from "node:fs";

const path = "./src/lib/data/workflow-templates-mock.ts";
let source = fs.readFileSync(path, "utf8");

source = source.replace(
  /export type MockWorkflow = \{\r?\n  id: string;/,
  "export type MockWorkflow = {\n  workflow_id: string;",
);
source = source.replace(/^    id: "wf_/gm, '    workflow_id: "wf_');
source = source.replace(/workflow\.id/g, "workflow.workflow_id");

fs.writeFileSync(path, source);
console.log("updated", path);
