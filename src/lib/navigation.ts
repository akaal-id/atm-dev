import type { EmployeeStatus, Permission, RoleKey } from "@/lib/types";

export type IconName =
  | "LayoutDashboard"
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
  | "Mail";

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

export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", permission: "dashboard:view" },
  { label: "My Tasks", href: "/tasks/my", icon: "CheckSquare", permission: "tasks:own" },
  { label: "Team Tasks", href: "/tasks/team", icon: "Users", permission: "dashboard:view" },
  { label: "Approvals", href: "/admin/approval", icon: "CheckSquare", permission: "admin:view" },
  { label: "Projects", href: "/projects", icon: "FolderKanban", permission: "dashboard:view" },
  { label: "Calendar", href: "/calendar", icon: "CalendarDays", permission: "dashboard:view" },
  { label: "Attendance", href: "/attendance", icon: "Clock3", permission: "attendance:own" },
  { label: "Announcements", href: "/announcements", icon: "Megaphone", permission: "announcements:view" },
  {
    label: "Email Blast",
    href: "/email-blast",
    icon: "Mail",
    permission: "dashboard:view",
    children: emailBlastNavigation,
  },
  { label: "Employees", href: "/employees", icon: "Users", permission: "employees:view" },
  { label: "Leaderboard", href: "/leaderboard", icon: "Trophy", permission: "leaderboard:view" },
  { label: "Messages", href: "/chat", icon: "MessageCircle", permission: "dashboard:view" },
];

export const adminNavigation: NavigationItem[] = [
  { label: "Admin", href: "/admin", icon: "Shield", permission: "admin:view" },
  { label: "Settings", href: "/admin/settings", icon: "Settings", permission: "settings:manage" },
  { label: "Roles", href: "/admin/roles", icon: "KeyRound", permission: "roles:manage" },
  { label: "Attendance Rules", href: "/admin/attendance-settings", icon: "Clock3", permission: "settings:manage" },
  { label: "Gamification", href: "/admin/gamification-settings", icon: "Sparkles", permission: "settings:manage" },
  { label: "Invite User", href: "/invite", icon: "UserPlus", permission: "employees:manage" },
];

export function isChatRoomPath(pathname: string) {
  return /^\/chat\/[^/]+$/.test(pathname);
}

export function usesTeamTaskNav(roleId: RoleKey, employmentStatus: EmployeeStatus | string) {
  return roleId === "super_admin" || roleId === "admin" || employmentStatus === "Manager";
}

export function getBottomNavigation(roleId: RoleKey, employmentStatus: EmployeeStatus | string): NavigationItem[] {
  const taskItem: NavigationItem = usesTeamTaskNav(roleId, employmentStatus)
    ? { label: "Team Task", href: "/tasks/team", icon: "Users", permission: "dashboard:view" }
    : { label: "My Task", href: "/tasks/my", icon: "CheckSquare", permission: "tasks:own" };

  return [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", permission: "dashboard:view" },
    taskItem,
    { label: "Attendance", href: "/attendance", icon: "Clock3", permission: "attendance:own" },
    { label: "Messages", href: "/chat", icon: "MessageCircle", permission: "dashboard:view" },
    { label: "Leaderboard", href: "/leaderboard", icon: "Trophy", permission: "leaderboard:view" },
  ];
}

export const pageCopy: Record<string, { title: string; eyebrow: string; description: string }> = {
  "/dashboard": {
    title: "Command center",
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
    eyebrow: "Performance gamification",
    description: "Weekly, monthly, department, and all-time scoreboards.",
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
    eyebrow: "Point engine",
    description: "Manage score rules, badges, deductions, and leaderboard logic.",
  },
  "/invite": {
    title: "Invite user",
    eyebrow: "Employee onboarding",
    description: "Register employees, choose role defaults, and prepare secure access.",
  },
};
