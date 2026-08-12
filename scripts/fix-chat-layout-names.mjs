import fs from "node:fs";

/** Current -> semantic */
const map = {
  sidebarUndefined: "shell",
  sidebarDiv: "shellRoomOpen",
  fullHeight: "shellListOnly",
  aside: "sidebar",
  sidebar: "sidebarExpanded",
  sidebarSidebar: "sectionHeader",
  sidebarH: "sidebarTitle",
  button: "iconButton",
  newChat: "iconSm",
  newChatUndefined: "searchBar",
  newChatNewChat: "searchField",
  newChatSearch: "searchIcon",
  input: "searchInput",
  nav: "roomList",
  sidebarP: "emptyRooms",
  link: "roomLink",
  item: "selected",
  meta: "groupAvatar",
  content: "roomInfo",
  group: "roomInfoTop",
  itemDescription: "roomName",
  badge: "roomTime",
  ellipsis: "roomSubtitle",
  main: "mainPane",
  mainWindow: "mainPaneVisible",
  mainWindowMainWindow: "mainPaneInner",
  panel: "dialogBackdrop",
  icon: "dialogCard",
  heading: "dialogTitle",
  control: "dialogClose",
  close: "dialogCloseIcon",
  closeUndefined: "dialogField",
  newChatInput: "groupNameInput",
  filterbarDiv: "peopleList",
  buttonButton: "personRow",
  ellipsisUndefined: "personName",
  caption: "personCheck",
  active: "personCheckOn",
  spanidle: "personCheckOff",
  region: "dialogFooter",
  buttonPrimary: "dialogSubmit",
  filterbar: "shellRoot",
};

function apply(file, isCss) {
  let s = fs.readFileSync(file, "utf8");
  for (const [from, to] of Object.entries(map).sort((a, b) => b[0].length - a[0].length)) {
    if (from === to) continue;
    const re = isCss ? new RegExp(`\\.${from}\\b`, "g") : new RegExp(`styles\\.${from}\\b`, "g");
    s = s.replace(re, isCss ? `.${to}` : `styles.${to}`);
  }
  fs.writeFileSync(file, s);
}

apply("src/components/app/chat/chat-layout/chat-layout.module.css", true);
apply("src/components/app/chat/chat-layout/chat-layout.tsx", false);

// report remaining suspicious
const css = fs.readFileSync("src/components/app/chat/chat-layout/chat-layout.module.css", "utf8");
const names = [...css.matchAll(/\.([A-Za-z_][\w]*)\b/g)].map((m) => m[1]);
const bad = [...new Set(names)].filter(
  (n) => /Undefined|NewChatNewChat|MainWindow|SidebarSidebar|[a-z]\d+$/i.test(n) || /^(filterbar|emptytext)$/.test(n),
);
console.log("chat-layout fixed; remaining suspicious:", bad);
