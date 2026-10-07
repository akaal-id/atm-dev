import type { Permission } from "@/lib/types";
import { appPathname } from "@/lib/tenant-path";

export type IconName =
  | "LayoutDashboard"
  | "House"
  | "Briefcase"
  | "CheckSquare"
  | "Users"
  | "FolderKanban"
  | "CalendarDays"
  | "Clock3"
  | "Megaphone"
  | "Trophy"
  | "Bell"
  | "Shield"
  | "Settings"
  | "KeyRound"
  | "Sparkles"
  | "UserPlus"
  | "MessageCircle"
  | "Mail"
  | "GitBranch"
  | "FileSpreadsheet";

export interface NavigationItem {
  label: string;
  href: string;
  icon: IconName;
  permission: Permission;
  children?: NavigationItem[];
}

export const emailBlastNavigation: NavigationItem[] = [
  { label: "Compose", href: "/email-blast", icon: "Mail", permission: "dashboard:view" },
  { label: "History", href: "/email-blast/history", icon: "Mail", permission: "dashboard:view" },
  { label: "Contacts", href: "/email-blast/contacts", icon: "Users", permission: "dashboard:view" },
  { label: "Settings", href: "/email-blast/settings", icon: "Settings", permission: "dashboard:view" },
];

export const taskNavigation: NavigationItem[] = [
  { label: "Workflow", href: "/workflows", icon: "GitBranch", permission: "dashboard:view" },
  { label: "My Task", href: "/tasks/my", icon: "CheckSquare", permission: "tasks:own" },
  { label: "Team Task", href: "/tasks/team", icon: "Users", permission: "dashboard:view" },
  { label: "Projects", href: "/projects", icon: "FolderKanban", permission: "dashboard:view" },
  { label: "Approvals", href: "/admin/approval", icon: "CheckSquare", permission: "admin:view" },
];

/** Everything that isn't day-to-day task work, grouped under one "Productivity" menu (and hub page). */
export const productivityNavigation: NavigationItem[] = [
  { label: "Office", href: "/office", icon: "FileSpreadsheet", permission: "dashboard:view" },
  { label: "Calendar", href: "/calendar", icon: "CalendarDays", permission: "dashboard:view" },
  { label: "Announcements", href: "/announcements", icon: "Megaphone", permission: "announcements:view" },
  { label: "Employees", href: "/employees", icon: "Users", permission: "employees:view" },
  { label: "Leaderboard", href: "/leaderboard", icon: "Trophy", permission: "leaderboard:view" },
  {
    label: "Email Blast",
    href: "/email-blast",
    icon: "Mail",
    permission: "dashboard:view",
    children: emailBlastNavigation,
  },
];

/** Groups link to a hub page (/tasks, /productivity) that lists their sub-menus — what phones open. */
export const primaryNavigation: NavigationItem[] = [
  // "Home" is the /dashboard page (URL kept so existing links and notifications still work).
  { label: "Home", href: "/dashboard", icon: "House", permission: "dashboard:view" },
  { label: "Attendance", href: "/attendance", icon: "Clock3", permission: "attendance:own" },
  {
    label: "Task",
    href: "/tasks",
    icon: "CheckSquare",
    permission: "dashboard:view",
    children: taskNavigation,
  },
  {
    label: "Productivity",
    href: "/productivity",
    icon: "Briefcase",
    permission: "dashboard:view",
    children: productivityNavigation,
  },
  { label: "Messages", href: "/chat", icon: "MessageCircle", permission: "dashboard:view" },
];

export const adminNavigation: NavigationItem[] = [
  { label: "Admin", href: "/admin", icon: "Shield", permission: "admin:view" },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: "Settings",
    permission: "settings:manage",
    children: [
      { label: "Company settings", href: "/admin/settings", icon: "Settings", permission: "settings:manage" },
      { label: "Attendance Rules", href: "/admin/attendance-settings", icon: "Clock3", permission: "settings:manage" },
      { label: "Gamification", href: "/admin/gamification-settings", icon: "Sparkles", permission: "settings:manage" },
    ],
  },
  { label: "Roles", href: "/admin/roles", icon: "KeyRound", permission: "roles:manage" },
  { label: "Invite User", href: "/invite", icon: "UserPlus", permission: "employees:manage" },
];

/** The chat list or a chat room — full-height, no page header. */
export function isChatPath(pathname: string) {
  return /^\/chat(\/[^/]+)?$/.test(appPathname(pathname));
}

export function isChatRoomPath(pathname: string) {
  return /^\/chat\/[^/]+$/.test(appPathname(pathname));
}

/** Phones: Home, Task, Attendance, Productivity, Messages. Task and Productivity open their hub pages. */
export function getBottomNavigation(): NavigationItem[] {
  return [
    { label: "Home", href: "/dashboard", icon: "House", permission: "dashboard:view" },
    { label: "Task", href: "/tasks", icon: "CheckSquare", permission: "dashboard:view", children: taskNavigation },
    { label: "Attendance", href: "/attendance", icon: "Clock3", permission: "attendance:own" },
    { label: "Productivity", href: "/productivity", icon: "Briefcase", permission: "dashboard:view", children: productivityNavigation },
    { label: "Messages", href: "/chat", icon: "MessageCircle", permission: "dashboard:view" },
  ];
}

/** Keep only the entries `can` allows, at every level; groups left without children disappear. */
export function filterNavigation(items: NavigationItem[], can: (permission: Permission) => boolean): NavigationItem[] {
  return items
    .filter((item) => can(item.permission))
    .map((item) => (item.children ? { ...item, children: filterNavigation(item.children, can) } : item))
    .filter((item) => !item.children || item.children.length > 0);
}

/** Is this menu entry (or anything under it) the current page? Groups also own their hub page and its sub-paths. */
export function navItemMatches(pathname: string, item: NavigationItem): boolean {
  if (item.children?.length) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`) || item.children.some((child) => navItemMatches(pathname, child));
  }
  // "Compose" is the Email Blast root; its siblings (/email-blast/history…) are separate entries.
  if (item.href === "/email-blast") return pathname === "/email-blast";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export const pageCopy: Record<string, { title: string; eyebrow: string; description: string }> = {
  "/tasks": {
    title: "Task",
    eyebrow: "Menu",
    description: "Workflows, your tasks, the team board, projects, and approvals.",
  },
  "/productivity": {
    title: "Productivity",
    eyebrow: "Menu",
    description: "Documents, calendar, announcements, people, rankings, and email blasts.",
  },
  "/dashboard": {
    title: "Home",
    eyebrow: "Today at Akaal",
    description: "Tasks, approvals, attendance, celebrations, and updates in one focused view.",
  },
  "/tasks/my": {
    title: "My tasks",
    eyebrow: "Personal queue",
    description: "Your assignments, deadlines, comments, and status updates.",
  },
  "/tasks/team": {
    title: "Team tasks",
    eyebrow: "Shared execution",
    description: "Kanban planning, ownership, priorities, and team progress.",
  },
  "/projects": {
    title: "Projects",
    eyebrow: "Progress tracking",
    description: "Owners, timelines, milestones, notes, and delivery health.",
  },
  "/office": {
    title: "Office",
    eyebrow: "Documents",
    description: "Spreadsheets and documents filed under their project, plus your personal notes.",
  },
  "/workflows": {
    title: "Workflows",
    eyebrow: "Task boards",
    description: "Group tasks into boards with optional project links and Kanban columns.",
  },
  "/workflows/new": {
    title: "New workflow",
    eyebrow: "Task boards",
    description: "Name the board, choose Kanban columns, then optionally seed a backlog.",
  },
  "/project-files": {
    title: "Project Files",
    eyebrow: "Shared resources",
    description: "Files uploaded from tasks, grouped with their ticket, owner, and link.",
  },
  "/calendar": {
    title: "Calendar",
    eyebrow: "Live activity",
    description: "Birthdays, deadlines, leave, meetings, announcements, and milestones.",
  },
  "/attendance": {
    title: "Attendance",
    eyebrow: "Workday status",
    description: "Clock in, clock out, request leave, and review approval flows.",
  },
  "/attendance/request": {
    title: "Leave request",
    eyebrow: "Attendance workflow",
    description: "Submit izin, sick, cuti, WFH, or half-day requests.",
  },
  "/announcements": {
    title: "Announcements",
    eyebrow: "Company feed",
    description: "Pinned updates, scheduled notices, comments, and read tracking.",
  },
  "/email-blast": {
    title: "Email blast",
    eyebrow: "Marketing & sales",
    description: "Compose subject and body, attach files, pick recipients, and send mass email.",
  },
  "/email-blast/history": {
    title: "Send history",
    eyebrow: "Email blast",
    description: "Review past blasts, recipient counts, attachments, and delivery status.",
  },
  "/email-blast/contacts": {
    title: "Contact groups",
    eyebrow: "Email blast",
    description: "Save reusable recipient lists and pick a group when composing a blast.",
  },
  "/email-blast/contacts/[id]": {
    title: "Group detail",
    eyebrow: "Email blast",
    description: "Add or remove contacts for this group, then use it when composing a blast.",
  },
  "/email-blast/settings": {
    title: "Account settings",
    eyebrow: "Email blast",
    description: "Review your sender identity and blast preferences from the dashboard account.",
  },
  "/employees": {
    title: "Employees",
    eyebrow: "HR management",
    description: "Profiles, roles, birthdays, attendance, task history, and performance scores.",
  },
  "/leaderboard": {
    title: "Leaderboard",
    eyebrow: "Performance",
    description: "Monthly scores weighted by work type and compared against each track's target, so every role competes fairly.",
  },
  "/notifications": {
    title: "Notifications",
    eyebrow: "Realtime feed",
    description: "Mentions, assignments, approvals, reminders, and activity history.",
  },
  "/chat": {
    title: "Messages",
    eyebrow: "Team chat",
    description: "Direct messages, group rooms, file sharing, link previews, and task calls.",
  },
  "/admin": {
    title: "Admin dashboard",
    eyebrow: "System control",
    description: "Users, settings, task health, attendance, activities, and connected data sources.",
  },
  "/admin/approval": {
    title: "Task approvals",
    eyebrow: "System approvals",
    description: "Verify subtasks, review task reports, and authorize tasks for completion.",
  },
  "/admin/settings": {
    title: "CMS settings",
    eyebrow: "Application CMS",
    description: "Configure dashboard widgets, departments, statuses, and database connection settings.",
  },
  "/admin/roles": {
    title: "Roles and permissions",
    eyebrow: "Access control",
    description: "Configure role scopes and server-side permission rules.",
  },
  "/admin/attendance-settings": {
    title: "Attendance settings",
    eyebrow: "Policy rules",
    description: "Set official work hours, grace periods, holidays, and approval owners.",
  },
  "/admin/gamification-settings": {
    title: "Gamification settings",
    eyebrow: "Leaderboard",
    description: "Tracks, targets, score weights, work types, and manual adjustments for the leaderboard.",
  },
  "/invite": {
    title: "Invite user",
    eyebrow: "Employee onboarding",
    description: "Register employees, choose role defaults, and prepare secure access.",
  },
};

/** Top-level destinations (the phone bottom bar): no Back button there. */
const ROOT_PATHS = new Set(["/dashboard", "/tasks", "/attendance", "/productivity", "/chat"]);

export function isRootPath(pathname: string) {
  return ROOT_PATHS.has(pathname);
}

/**
 * Where "Back" goes when there's no in-app history (e.g. opened from a notification):
 * a menu entry → its group's hub (/projects → /tasks, /calendar → /productivity),
 * an admin page → /productivity (its phone entry), anything deeper → one level up.
 */
export function parentHref(pathname: string): string {
  if (ROOT_PATHS.has(pathname)) return "/dashboard";
  for (const group of primaryNavigation) {
    for (const child of group.children ?? []) {
      if (child.href === pathname || child.children?.some((grandchild) => grandchild.href === pathname)) return group.href;
    }
  }
  const adminHrefs = adminNavigation.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]);
  if (adminHrefs.includes(pathname)) return "/productivity";
  return pathname.replace(/\/[^/]+$/, "") || "/dashboard";
}
