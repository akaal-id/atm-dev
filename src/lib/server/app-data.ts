import "server-only";

import type { AppData } from "@/components/app/views";
import { requireUser } from "@/lib/server/auth";
import { listResource, type ResourceName } from "@/lib/server/store";

export const appDataResources = [
  "Users",
  "Departments",
  "Roles",
  "Tasks",
  "Task_Comments",
  "Task_Checklists",
  "Project_Files",
  "Projects",
  "Attendance",
  "Leave_Requests",
  "Announcements",
  "Calendar_Events",
  "Notifications",
  "Gamification_Points",
  "Badges",
  "User_Badges",
  "Activity_Logs",
  "Settings",
] as const satisfies readonly ResourceName[];

export type AppDataResource = (typeof appDataResources)[number];

function createEmptyAppData(currentUser: AppData["currentUser"]): AppData {
  return {
    currentUser,
    users: [],
    departments: [],
    roles: [],
    tasks: [],
    comments: [],
    checklists: [],
    projectFiles: [],
    projects: [],
    attendance: [],
    leaveRequests: [],
    announcements: [],
    calendarEvents: [],
    notifications: [],
    points: [],
    badges: [],
    userBadges: [],
    activityLogs: [],
    settings: [],
  };
}

export async function getAppData(resources: readonly AppDataResource[] = appDataResources): Promise<AppData> {
  const currentUser = await requireUser();
  const data = createEmptyAppData(currentUser);
  const requestedResources = Array.from(new Set(resources));
  const rows = await Promise.all(requestedResources.map(async (resource) => [resource, await listResource(resource)] as const));

  rows.forEach(([resource, records]) => {
    switch (resource) {
      case "Users":
        data.users = records as AppData["users"];
        break;
      case "Departments":
        data.departments = records as AppData["departments"];
        break;
      case "Roles":
        data.roles = records as AppData["roles"];
        break;
      case "Tasks":
        data.tasks = records as AppData["tasks"];
        break;
      case "Task_Comments":
        data.comments = records as AppData["comments"];
        break;
      case "Task_Checklists":
        data.checklists = records as AppData["checklists"];
        break;
      case "Project_Files":
        data.projectFiles = records as AppData["projectFiles"];
        break;
      case "Projects":
        data.projects = records as AppData["projects"];
        break;
      case "Attendance":
        data.attendance = records as AppData["attendance"];
        break;
      case "Leave_Requests":
        data.leaveRequests = records as AppData["leaveRequests"];
        break;
      case "Announcements":
        data.announcements = records as AppData["announcements"];
        break;
      case "Calendar_Events":
        data.calendarEvents = records as AppData["calendarEvents"];
        break;
      case "Notifications":
        data.notifications = records as AppData["notifications"];
        break;
      case "Gamification_Points":
        data.points = records as AppData["points"];
        break;
      case "Badges":
        data.badges = records as AppData["badges"];
        break;
      case "User_Badges":
        data.userBadges = records as AppData["userBadges"];
        break;
      case "Activity_Logs":
        data.activityLogs = records as AppData["activityLogs"];
        break;
      case "Settings":
        data.settings = records as AppData["settings"];
        break;
    }
  });

  return data;
}
