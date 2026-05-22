import "server-only";

import { requireUser } from "@/lib/server/auth";
import { listResource } from "@/lib/server/store";

export async function getAppData() {
  const currentUser = await requireUser();
  const [
    users,
    departments,
    roles,
    tasks,
    comments,
    checklists,
    projects,
    attendance,
    leaveRequests,
    announcements,
    calendarEvents,
    notifications,
    points,
    badges,
    userBadges,
    activityLogs,
    settings,
  ] = await Promise.all([
    listResource("Users"),
    listResource("Departments"),
    listResource("Roles"),
    listResource("Tasks"),
    listResource("Task_Comments"),
    listResource("Task_Checklists"),
    listResource("Projects"),
    listResource("Attendance"),
    listResource("Leave_Requests"),
    listResource("Announcements"),
    listResource("Calendar_Events"),
    listResource("Notifications"),
    listResource("Gamification_Points"),
    listResource("Badges"),
    listResource("User_Badges"),
    listResource("Activity_Logs"),
    listResource("Settings"),
  ]);

  return {
    currentUser,
    users,
    departments,
    roles,
    tasks,
    comments,
    checklists,
    projects,
    attendance,
    leaveRequests,
    announcements,
    calendarEvents,
    notifications,
    points,
    badges,
    userBadges,
    activityLogs,
    settings,
  };
}
