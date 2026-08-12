import fs from "node:fs";

const map = {
  filter: "toolbar",
  row: "statusTabs",
  button: "statusTab",
  button2: "statusTabActive",
  button3: "statusTabIdle",
  meta: "statusTabCount",
  filter2: "statusTabCountActive",
  filter3: "statusTabCountIdle",
  marker: "projectFilter",
  marker7: "projectFilterIcon",
  slot: "projectSelect",
  marker8: "emptyState",
  marker9: "emptyIcon",
  subheading: "emptyTitle",
  itemDescription: "emptyText",
  grid: "taskList",
  slot2: "taskCard",
  grid2: "taskCardGrid",
  content: "taskDetails",
  row3: "taskIdRow",
  slot3: "taskId",
  link: "taskTitle",
  itemDescription2: "taskDescription",
  row4: "metaField",
  meta2: "metaLabel",
  emptystate3: "metaValue",
  meta3: "metaValueMuted",
  row5: "assigneeAvatars",
  row6: "statusField",
  slot5: "checklistSection",
  stack: "checklistHeaderStack",
  row7: "checklistHeader",
  stack2: "checklistList",
  row8: "checklistItem",
  slot6: "checklistItemText",
  slot7: "checklistItemTextDone",
  slot8: "checklistItemTextTodo",
  row9: "checklistActions",
  row10: "assigneeToggle",
  grid3: "checkBox",
  meta4: "checkBoxDone",
  meta5: "checkBoxIdle",
  marker2: "checkBoxDisabled",
  marker3: "checkIcon",
  meta6: "checkLabel",
  meta7: "checkLabelDone",
  meta8: "checkLabelMuted",
  row11: "leaderToggle",
  slot9: "leaderToggleReady",
  slot10: "leaderToggleLocked",
  meta9: "checkBoxLeaderDone",
  emptystate4: "hintText",
  row12: "approvalBanner",
  marker4: "approvalBannerText",
  marker10: "approvalBannerIcon",
  toolbar: "cardActions",
  marker5: "actionButton",
  marker11: "spinner",
  marker12: "approveIcon",
  marker6: "warning",
  marker13: "warningIcon",
};

function apply(file, isCss) {
  let s = fs.readFileSync(file, "utf8");
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    if (from === to) continue;
    const re = isCss ? new RegExp(`\\.${from}\\b`, "g") : new RegExp(`styles\\.${from}\\b`, "g");
    const rep = isCss ? `.${to}` : `styles.${to}`;
    s = s.replace(re, rep);
  }
  fs.writeFileSync(file, s);
}

apply("src/components/app/approval-view/approval-view.module.css", true);
apply("src/components/app/approval-view/approval-view.tsx", false);
console.log("approval-view renamed");
