import type { Permission } from "@/lib/types";

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
  | "UserPlus";

export interface NavigationItem {
  label: string;
  href: string;
  icon: IconName;
  permission: Permission;
}

export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", permission: "dashboard:view" },
  { label: "My Tasks", href: "/tasks/my", icon: "CheckSquare", permission: "tasks:own" },
  { label: "Team Tasks", href: "/tasks/team", icon: "Users", permission: "dashboard:view" },
  { label: "Projects", href: "/projects", icon: "FolderKanban", permission: "dashboard:view" },
  { label: "Calendar", href: "/calendar", icon: "CalendarDays", permission: "dashboard:view" },
  { label: "Attendance", href: "/attendance", icon: "Clock3", permission: "attendance:own" },
  { label: "Announcements", href: "/announcements", icon: "Megaphone", permission: "announcements:view" },
  { label: "Employees", href: "/employees", icon: "Users", permission: "employees:view" },
  { label: "Leaderboard", href: "/leaderboard", icon: "Trophy", permission: "leaderboard:view" },
  { label: "Notifications", href: "/notifications", icon: "Bell", permission: "notifications:view" },
];

export const adminNavigation: NavigationItem[] = [
  { label: "Admin", href: "/admin", icon: "Shield", permission: "admin:view" },
  { label: "Settings", href: "/admin/settings", icon: "Settings", permission: "settings:manage" },
  { label: "Roles", href: "/admin/roles", icon: "KeyRound", permission: "roles:manage" },
  { label: "Attendance Rules", href: "/admin/attendance-settings", icon: "Clock3", permission: "settings:manage" },
  { label: "Gamification", href: "/admin/gamification-settings", icon: "Sparkles", permission: "settings:manage" },
  { label: "Invite User", href: "/invite", icon: "UserPlus", permission: "employees:manage" },
];

export const bottomNavigation: NavigationItem[] = [
  primaryNavigation[0],
  primaryNavigation[1],
  primaryNavigation[4],
  primaryNavigation[5],
  primaryNavigation[8],
];

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
  "/admin": {
    title: "Admin dashboard",
    eyebrow: "System control",
    description: "Users, settings, task health, attendance, activities, and connected data sources.",
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
