import type { Announcement, Attendance, CurrentUser, LeaveRequest, Task, User } from "@/lib/types";

const JAKARTA_TIMEZONE = "Asia/Jakarta";

const COMPLETED_TASK_STATUSES = new Set(["Done", "Approved", "Completed"]);
const ACTIVE_TASK_STATUSES_EXCLUDED = new Set(["Done", "Cancelled", "Approved", "Completed"]);
const ABSENT_ATTENDANCE_STATUSES = new Set(["Absent", "Rejected"]);

export function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function jakartaMonthDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentWeekRange(reference = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(reference);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: JAKARTA_TIMEZONE, weekday: "short" }).format(reference);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const mondayOffset = weekdayIndex === 0 ? -6 : 1 - weekdayIndex;
  const start = new Date(Date.UTC(year, month - 1, day + mondayOffset));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const toIso = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

  return { start: toIso(start), end: toIso(end) };
}

export function isDateInRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export function directoryUsers(users: User[]) {
  return users.filter((user) => user.signup_status !== "rejected");
}

export function activeUsers(users: User[]) {
  return directoryUsers(users).filter((user) => user.is_active);
}

export function visibleTasksForUser(tasks: Task[], userId: string) {
  return tasks.filter((task) => Array.isArray(task.assigned_to) && task.assigned_to.includes(userId));
}

export function activeTasks(tasks: Task[]) {
  return tasks.filter((task) => !ACTIVE_TASK_STATUSES_EXCLUDED.has(task.status));
}

export function completedTasks(tasks: Task[]) {
  return tasks.filter((task) => COMPLETED_TASK_STATUSES.has(task.status));
}

export function taskCompletionRate(tasks: Task[]) {
  if (tasks.length === 0) return 0;
  return Math.round((completedTasks(tasks).length / tasks.length) * 100);
}

export function tasksDueOnDate(tasks: Task[], date: string) {
  return tasks.filter((task) => task.due_date === date);
}

export function getTodayAttendance(attendance: Attendance[], userId: string) {
  const today = jakartaToday();
  return attendance
    .filter((record) => record.user_id === userId)
    .sort((left, right) => right.date.localeCompare(left.date) || right.updated_at.localeCompare(left.updated_at))
    .find((record) => record.date === today);
}

export function getClockStatus(record?: Attendance) {
  if (!record?.clock_in) {
    return { value: "Off shift", detail: "Ready to start" };
  }

  if (!record.clock_out) {
    return { value: "Active", detail: `Clocked in ${record.clock_in}` };
  }

  return { value: "Complete", detail: `Finished at ${record.clock_out}` };
}

export function teamAttendanceRateThisWeek(attendance: Attendance[], users: User[]) {
  const team = activeUsers(users);
  if (team.length === 0) return 0;

  const { start, end } = currentWeekRange();
  const teamIds = new Set(team.map((user) => user.user_id));
  const presentThisWeek = new Set(
    attendance
      .filter(
        (record) =>
          teamIds.has(record.user_id) &&
          isDateInRange(record.date, start, end) &&
          !ABSENT_ATTENDANCE_STATUSES.has(record.status),
      )
      .map((record) => record.user_id),
  );

  return Math.round((presentThisWeek.size / team.length) * 100);
}

export function attendanceLateCount(attendance: Attendance[], range?: { start: string; end: string }) {
  return attendance.filter(
    (record) => record.status === "Late" && (!range || isDateInRange(record.date, range.start, range.end)),
  ).length;
}

export function userAttendanceRateThisWeek(attendance: Attendance[], userId: string) {
  const { start, end } = currentWeekRange();
  const weekRecords = attendance.filter((record) => record.user_id === userId && isDateInRange(record.date, start, end));
  if (weekRecords.length === 0) return 0;

  const presentDays = weekRecords.filter((record) => !ABSENT_ATTENDANCE_STATUSES.has(record.status)).length;
  return Math.round((presentDays / weekRecords.length) * 100);
}

export function pendingLeaveRequests(leaveRequests: LeaveRequest[], options?: { userId?: string; approverView?: boolean }) {
  const pending = leaveRequests.filter((request) => request.status === "Pending Approval");
  if (options?.approverView) return pending;
  if (options?.userId) return pending.filter((request) => request.user_id === options.userId);
  return pending;
}

function birthdayMonthDay(birthday: string) {
  const normalized = birthday.trim().slice(0, 10);
  if (normalized.length < 10) return null;
  return normalized.slice(5, 10);
}

function daysUntilBirthday(birthday: string, reference = new Date()) {
  const monthDay = birthdayMonthDay(birthday);
  if (!monthDay) return Number.POSITIVE_INFINITY;

  const [birthMonth, birthDay] = monthDay.split("-").map(Number);
  if (!birthMonth || !birthDay) return Number.POSITIVE_INFINITY;
  const jakartaNow = new Date(reference.toLocaleString("en-US", { timeZone: JAKARTA_TIMEZONE }));
  let nextBirthday = new Date(jakartaNow.getFullYear(), birthMonth - 1, birthDay);
  if (nextBirthday < jakartaNow) {
    nextBirthday = new Date(jakartaNow.getFullYear() + 1, birthMonth - 1, birthDay);
  }

  return Math.ceil((nextBirthday.getTime() - jakartaNow.getTime()) / 86_400_000);
}

export function upcomingBirthdays(users: User[], withinDays = 30) {
  return activeUsers(users)
    .filter((user) => {
      const delta = daysUntilBirthday(user.birthday);
      return delta >= 0 && delta <= withinDays;
    })
    .sort((left, right) => daysUntilBirthday(left.birthday) - daysUntilBirthday(right.birthday));
}

export function announcementsForUser(announcements: Announcement[], user: Pick<CurrentUser, "user_id" | "department_id">) {
  return announcements.filter((announcement) => {
    if (announcement.target_department === "all") return true;
    if (announcement.target_department && announcement.target_department === user.department_id) return true;
    return Array.isArray(announcement.target_users) && announcement.target_users.includes(user.user_id);
  });
}

export function latestAnnouncementLabel(announcements: Announcement[]) {
  if (announcements.length === 0) return "No posts yet";

  const latest = [...announcements].sort((left, right) => right.scheduled_at.localeCompare(left.scheduled_at))[0];
  const scheduled = new Date(latest.scheduled_at);
  if (Number.isNaN(scheduled.getTime())) return "Recently updated";

  const today = jakartaToday();
  const scheduledDay = latest.scheduled_at.slice(0, 10);
  if (scheduledDay === today) return "Updated today";

  return new Intl.DateTimeFormat("en", {
    timeZone: JAKARTA_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(scheduled);
}

export function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
