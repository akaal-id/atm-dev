import Link from "next/link";
import {
  Activity,
  AlarmClock,
  Bell,
  Building2,
  Cake,
  CalendarCheck,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Crown,
  Download,
  Filter,
  Gauge,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";

import { MarkAllNotificationsReadButton, NotificationLink } from "@/components/app/notification-actions";
import { Page, ScrollRow } from "@/components/app/page-layout";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { MetricCard } from "@/components/ui/metric-card";
import { Progress } from "@/components/ui/progress";
import { StatusPill, statusTone } from "@/components/ui/status-pill";
import {
  activeTasks,
  activeUsers,
  announcementsForUser,
  attendanceLateCount,
  completedTasks,
  currentWeekRange,
  directoryUsers,
  getClockStatus,
  getTodayAttendance,
  jakartaToday,
  latestAnnouncementLabel,
  pendingLeaveRequests,
  taskCompletionRate,
  tasksDueOnDate,
  teamAttendanceRateThisWeek,
  upcomingBirthdays,
  userAttendanceRateThisWeek,
  visibleTasksForUser,
  clampProgress,
} from "@/lib/metrics";
import { attendanceStatuses, employeeStatusOptions, hasPermission, projectStatuses, taskStatuses } from "@/lib/permissions";
import type {
  ActivityLog,
  Announcement,
  Attendance,
  Badge as BadgeType,
  CalendarEvent,
  CurrentUser,
  Department,
  GamificationPoint,
  LeaveRequest,
  AppNotification,
  Project,
  Role,
  Setting,
  Task,
  TaskChecklist,
  TaskComment,
  User,
  UserBadge,
} from "@/lib/types";
import { cn, formatDate, formatShortDate, groupBy, isNumericDisplay, percent } from "@/lib/utils";

export type AppData = {
  currentUser: CurrentUser;
  users: User[];
  departments: Department[];
  roles: Role[];
  tasks: Task[];
  comments: TaskComment[];
  checklists: TaskChecklist[];
  projects: Project[];
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
  announcements: Announcement[];
  calendarEvents: CalendarEvent[];
  notifications: AppNotification[];
  points: GamificationPoint[];
  badges: BadgeType[];
  userBadges: UserBadge[];
  activityLogs: ActivityLog[];
  settings: Setting[];
};

function userName(users: User[], id: string) {
  return users.find((user) => user.user_id === id)?.full_name ?? "Unassigned";
}

function departmentName(departments: Department[], id: string) {
  return departments.find((department) => department.department_id === id)?.department_name ?? "No department";
}

function dataSourceLabel() {
  if (process.env.ATM_DATA_MODE === "supabase") return "Supabase";
  if (process.env.ATM_DATA_MODE === "apps_script") return "Google Apps Script";
  if (process.env.ATM_DATA_MODE === "sheets") return "Google Sheets";
  return "Seed fallback";
}

function supabaseConfigLabel() {
  return process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_ID ? "Configured" : "Not configured";
}

function supabaseSecretLabel() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY ? "Configured" : "Not configured";
}

function scoreForUser(points: GamificationPoint[], userId: string) {
  return points.filter((point) => point.user_id === userId).reduce((total, point) => total + point.points, 0);
}

function leaderboardRows(data: Pick<AppData, "users" | "points" | "badges" | "userBadges">) {
  return data.users
    .filter((user) => user.is_active)
    .map((user) => {
      const earnedBadges = data.userBadges
        .filter((userBadge) => userBadge.user_id === user.user_id)
        .map((userBadge) => data.badges.find((badge) => badge.badge_id === userBadge.badge_id))
        .filter(Boolean) as BadgeType[];

      return {
        user,
        points: scoreForUser(data.points, user.user_id),
        badges: earnedBadges,
      };
    })
    .sort((a, b) => b.points - a.points);
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-semibold tracking-normal text-slate-950">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-medium text-slate-500">{label}</div>;
}

function LeaveApprovalActions({ requestId, canApprove, status }: { requestId: string; canApprove: boolean; status: string }) {
  if (!canApprove || status !== "Pending Approval") return null;

  return (
    <div className="mt-4 grid gap-2 lg:min-w-80 lg:grid-cols-2">
      <form action={`/api/admin/leave-requests/${requestId}`} method="post" className="grid gap-2">
        <input type="hidden" name="intent" value="approve" />
        <input name="approval_note" className="input" placeholder="Approval note (optional)" />
        <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
          <CheckCircle2 className="h-4 w-4" />
          Approve
        </button>
      </form>
      <form action={`/api/admin/leave-requests/${requestId}`} method="post" className="grid gap-2">
        <input type="hidden" name="intent" value="reject" />
        <input name="approval_note" className="input" placeholder="Reason for rejection" />
        <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50">
          <XCircle className="h-4 w-4" />
          Reject
        </button>
      </form>
    </div>
  );
}

function LeaveRequestCard({
  request,
  users,
  canApprove,
}: {
  request: LeaveRequest;
  users: User[];
  canApprove: boolean;
}) {
  const approverName = request.approved_by ? userName(users, request.approved_by) : "";

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{userName(users, request.user_id)}</p>
          <p className="mt-1 text-sm text-slate-500">
            {request.request_type} from {formatShortDate(request.start_date)} to {formatShortDate(request.end_date)}
          </p>
        </div>
        <StatusPill status={request.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{request.reason}</p>
      {request.attachment_url ? (
        <a href={request.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-blue-600">
          View attachment
        </a>
      ) : null}
      {request.approval_note ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-950">{request.status === "Approved" ? "Approval note" : "Rejection note"}:</span> {request.approval_note}
          {approverName ? <span className="mt-1 block text-xs font-medium text-slate-400">By {approverName}</span> : null}
        </p>
      ) : null}
      <LeaveApprovalActions requestId={request.request_id} canApprove={canApprove} status={request.status} />
    </div>
  );
}

function DataToolbar({ tabs }: { tabs: string[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            className={cn("h-9 shrink-0 whitespace-nowrap rounded-md px-3 text-sm font-semibold text-slate-500", index === 0 && "bg-slate-950 text-white")}
          >
            {tab}
          </button>
        ))}
      </div>
      <button className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300">
        <Filter className="h-4 w-4" />
        Filter
      </button>
    </div>
  );
}

export function DashboardView(data: AppData) {
  const myTasks = visibleTasksForUser(data.tasks, data.currentUser.user_id);
  const myActiveTasks = activeTasks(myTasks);
  const myCompletedTasks = completedTasks(myTasks);
  const dueToday = tasksDueOnDate(myActiveTasks, jakartaToday());
  const canApproveLeave = hasPermission(data.currentUser.role_id, "attendance:approve");
  const pendingApprovals = pendingLeaveRequests(data.leaveRequests, canApproveLeave ? { approverView: true } : { userId: data.currentUser.user_id });
  const attendanceRate = teamAttendanceRateThisWeek(data.attendance, data.users);
  const weekRange = currentWeekRange();
  const unread = data.notifications.filter((notification) => notification.user_id === data.currentUser.user_id && !notification.is_read);
  const upcomingEvents = [...data.calendarEvents]
    .sort((left, right) => left.start_date.localeCompare(right.start_date))
    .slice(0, 4);
  const leaderboard = leaderboardRows(data).slice(0, 4);
  const birthdays = upcomingBirthdays(data.users, 30).slice(0, 3);

  return (
    <Page>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active tasks"
          value={String(myActiveTasks.length)}
          detail={`${dueToday.length} due today · ${myCompletedTasks.length} completed`}
          icon={CheckSquare}
          tone="dark"
        />
        <MetricCard label="Attendance" value={`${attendanceRate}%`} detail={`Team checked-in this week (${weekRange.start} to ${weekRange.end})`} icon={CalendarCheck} tone="green" />
        <MetricCard
          label="Approvals"
          value={String(pendingApprovals.length)}
          detail={canApproveLeave ? "Leave requests awaiting approval" : "Your leave requests pending"}
          icon={ShieldCheck}
          tone="yellow"
        />
        <MetricCard label="Unread" value={String(unread.length)} detail="Mentions and reminders" icon={Bell} tone="blue" />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <SectionTitle title="Today focus" action={<Link href="/tasks/my" className="text-sm font-semibold text-blue-600">Open tasks</Link>} />
          </CardHeader>
          <CardBody className="space-y-3">
            {myActiveTasks.slice(0, 5).map((task) => (
              <article key={task.task_id} className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/tasks/${task.task_id}`} className="font-semibold text-slate-950 transition hover:text-blue-600">
                      {task.title}
                    </Link>
                    <LinkifiedText text={task.description} className="mt-1 line-clamp-2 text-sm text-slate-500" />
                  </div>
                  <StatusPill status={task.status} />
                </div>
                <div className="mt-4">
                  <Progress value={clampProgress(task.progress)} label={`Due ${formatShortDate(task.due_date)}`} />
                </div>
              </article>
            ))}
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <SectionTitle title="Performance" action={<Trophy className="h-4 w-4 text-amber-500" />} />
            </CardHeader>
            <CardBody className="space-y-3">
              {leaderboard.map((row, index) => (
                <div key={row.user.user_id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{index + 1}</div>
                  <Avatar name={row.user.full_name} image={row.user.profile_photo} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{row.user.full_name}</p>
                    <p className="text-xs text-slate-500">{row.badges[0]?.badge_name ?? "Building streak"}</p>
                  </div>
                  <p className="font-mono text-sm font-bold tabular-nums text-slate-950">{row.points}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle title="Birthdays" action={<Cake className="h-4 w-4 text-rose-500" />} />
            </CardHeader>
            <CardBody className="space-y-3">
              {birthdays.map((user) => (
                <div key={user.user_id} className="flex items-center gap-3 rounded-lg bg-rose-50 p-3">
                  <Avatar name={user.full_name} image={user.profile_photo} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{user.full_name}</p>
                    <p className="text-xs text-rose-700">{formatShortDate(user.birthday)}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle title="Calendar preview" action={<Link href="/calendar" className="text-sm font-semibold text-blue-600">View calendar</Link>} />
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            {upcomingEvents.map((event) => (
              <div key={event.event_id} className="rounded-lg border border-slate-200 p-4">
                <Badge tone={statusTone(event.type)}>{event.type}</Badge>
                <p className="mt-3 font-semibold text-slate-950">{event.title}</p>
                <p className="mt-1 text-sm text-slate-500">{formatDate(event.start_date, { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Pinned updates" />
          </CardHeader>
          <CardBody className="space-y-3">
            {data.announcements.slice(0, 2).map((announcement) => (
              <Link key={announcement.announcement_id} href="/announcements" className="block rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50">
                <Badge tone={announcement.is_pinned ? "yellow" : "blue"}>{announcement.category}</Badge>
                <p className="mt-3 text-sm font-semibold text-slate-950">{announcement.title}</p>
                <p className="mt-1 line-clamp-3 text-sm text-slate-500">{announcement.body}</p>
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}

export function TaskListView({ data, scope }: { data: AppData; scope: "my" | "team" }) {
  const tasks = scope === "my" ? visibleTasksForUser(data.tasks, data.currentUser.user_id) : data.tasks;
  const activeTaskCount = activeTasks(tasks).length;
  const grouped = groupBy(tasks, (task) => task.status);

  if (scope === "team") {
    return (
      <Page>
        <DataToolbar tabs={["Board", "List", "Calendar", "Project"]} />
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <ScrollRow className="lg:grid-cols-4">
            {["To Do", "In Progress", "Waiting Approval", "Need Revision"].map((status) => (
              <Card key={status} className="w-[min(100%,17.5rem)] shrink-0 snap-start lg:w-auto lg:min-w-0 lg:shrink">
                <CardHeader>
                  <SectionTitle title={status} action={<Badge>{grouped[status]?.length ?? 0}</Badge>} />
                </CardHeader>
                <CardBody className="space-y-3">
                  {(grouped[status] ?? []).map((task) => (
                    <TaskCard key={task.task_id} task={task} users={data.users} compact />
                  ))}
                  {!grouped[status]?.length ? <EmptyState label="No tasks in this lane" /> : null}
                </CardBody>
              </Card>
            ))}
          </ScrollRow>
          <CreateTaskForm data={data} title="Create team task" />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <DataToolbar tabs={["List", "Board", "Calendar"]} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card>
          <CardHeader>
            <SectionTitle title="Assigned to you" action={<Badge tone="blue">{activeTaskCount} active</Badge>} />
          </CardHeader>
          <CardBody className="space-y-3">
            {tasks.map((task) => (
              <TaskCard key={task.task_id} task={task} users={data.users} />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <SectionTitle title="Upcoming deadlines" />
          </CardHeader>
          <CardBody className="space-y-3">
            {activeTasks(tasks)
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .slice(0, 5)
              .map((task) => (
                <Link href={`/tasks/${task.task_id}`} key={task.task_id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{task.title}</p>
                    <p className="text-xs text-slate-500">{formatShortDate(task.due_date)}</p>
                  </div>
                  <Badge tone={task.priority === "Urgent" ? "red" : task.priority === "High" ? "yellow" : "neutral"}>{task.priority}</Badge>
                </Link>
              ))}
          </CardBody>
        </Card>
        <CreateTaskForm data={data} title="Create task" />
      </div>
    </Page>
  );
}

function CreateTaskForm({ data, title }: { data: AppData; title: string }) {
  const activeUsers = data.users.filter((user) => user.is_active);

  return (
    <Card>
      <CardHeader>
        <SectionTitle title={title} action={<Plus className="h-4 w-4 text-blue-600" />} />
      </CardHeader>
      <CardBody>
        <form action="/api/resources/Tasks" method="post" className="space-y-4">
          <input type="hidden" name="assigned_by" value={data.currentUser.user_id} />
          <Field label="Title">
            <input name="title" required className="input" placeholder="Write a clear task title" />
          </Field>
          <Field label="Description">
            <textarea name="description" required className="input min-h-24 resize-y" placeholder="What needs to be done?" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Project">
              <select name="project_id" className="input">
                <option value="">No project</option>
                {data.projects.map((project) => (
                  <option key={project.project_id} value={project.project_id}>
                    {project.project_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue="Medium" className="input">
                {["Low", "Medium", "High", "Urgent"].map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Due date">
              <input name="due_date" type="date" required className="input" />
            </Field>
            <Field label="Progress">
              <input name="progress" type="number" min="0" max="100" defaultValue="0" className="input" />
            </Field>
          </div>
          <Field label="Assign to">
            <select name="assigned_to" multiple required defaultValue={[data.currentUser.user_id]} className="input min-h-32">
              {activeUsers.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Labels">
            <input name="labels" className="input" placeholder="Design, Urgent, Client" />
          </Field>
          <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
            <Plus className="h-4 w-4" />
            Create task
          </button>
        </form>
      </CardBody>
    </Card>
  );
}

function TaskCard({ task, users, compact = false }: { task: Task; users: User[]; compact?: boolean }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/tasks/${task.task_id}`} className="break-words font-semibold text-slate-950 transition hover:text-blue-600">
            {task.title}
          </Link>
          {!compact ? <LinkifiedText text={task.description} className="mt-1 line-clamp-2 text-sm text-slate-500" /> : null}
        </div>
        <StatusPill status={task.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={task.priority === "Urgent" ? "red" : task.priority === "High" ? "yellow" : "neutral"}>{task.priority}</Badge>
        {task.labels.slice(0, 3).map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </div>
      <div className="mt-4">
        <Progress value={clampProgress(task.progress)} label={`Due ${formatShortDate(task.due_date)}`} />
      </div>
      <div className="mt-4 flex -space-x-2">
        {task.assigned_to.map((id) => (
          <Avatar key={id} name={userName(users, id)} size="sm" />
        ))}
      </div>
    </article>
  );
}

export function TaskDetailView({ data, task }: { data: AppData; task: Task }) {
  const comments = data.comments.filter((comment) => comment.task_id === task.task_id);
  const checklist = data.checklists.filter((item) => item.task_id === task.task_id);
  const project = data.projects.find((candidate) => candidate.project_id === task.project_id);

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-2xl font-semibold tracking-normal text-slate-950">{task.title}</h2>
                <LinkifiedText text={task.description} className="mt-2 max-w-3xl text-sm leading-6 text-slate-500" />
              </div>
              <StatusPill status={task.status} />
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            <Progress value={clampProgress(task.progress)} />
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile label="Project" value={project?.project_name ?? "No project"} />
              <InfoTile label="Due date" value={formatDate(task.due_date)} />
              <InfoTile label="Priority" value={task.priority} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Checklist" />
          </CardHeader>
          <CardBody className="space-y-3">
            {checklist.map((item) => (
              <div key={item.checklist_id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <CheckCircle2 className={cn("h-5 w-5", item.is_completed ? "text-emerald-600" : "text-slate-300")} />
                <p className={cn("text-sm font-medium", item.is_completed ? "text-slate-500 line-through" : "text-slate-950")}>{item.title}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Realtime comments" action={<Badge tone="blue">{comments.length}</Badge>} />
          </CardHeader>
          <CardBody className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.comment_id} className="flex gap-3">
                <Avatar name={userName(data.users, comment.user_id)} size="sm" />
                <div className="flex-1 rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-950">{userName(data.users, comment.user_id)}</p>
                    <p className="text-xs text-slate-500">{formatDate(comment.created_at, { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{comment.comment}</p>
                </div>
              </div>
            ))}
            <form action="/api/resources/Task_Comments" method="post" className="space-y-3">
              <input type="hidden" name="task_id" value={task.task_id} />
              <input type="hidden" name="user_id" value={data.currentUser.user_id} />
              <textarea name="comment" required className="min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Add an update or mention a teammate" />
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                <MessageCircle className="h-4 w-4" />
                Add comment
              </button>
            </form>
          </CardBody>
        </Card>
      </div>

      <div className="min-w-0 space-y-5">
        <TaskUpdateForm task={task} users={data.users} />
        <Card>
          <CardHeader>
            <SectionTitle title="Assignees" />
          </CardHeader>
          <CardBody className="space-y-3">
            {task.assigned_to.map((id) => (
              <div key={id} className="flex items-center gap-3">
                <Avatar name={userName(data.users, id)} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-slate-950">{userName(data.users, id)}</p>
                  <p className="text-xs text-slate-500">Assigned by {userName(data.users, task.assigned_by)}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
        <ActivityFeed logs={data.activityLogs} users={data.users} />
      </div>
    </div>
  );
}

function TaskUpdateForm({ task, users }: { task: Task; users: User[] }) {
  const activeUsers = users.filter((user) => user.is_active);

  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Update task" />
      </CardHeader>
      <CardBody>
        <form action={`/api/resources/Tasks/${task.task_id}`} method="post" className="space-y-4">
          <Field label="Status">
            <select name="status" defaultValue={task.status} className="input">
              {taskStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </Field>
          <Field label="Progress">
            <input name="progress" type="number" min="0" max="100" defaultValue={task.progress} className="input" />
          </Field>
          <Field label="Reassign">
            <select name="assigned_to" multiple defaultValue={task.assigned_to} className="input min-h-32">
              {activeUsers.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </Field>
          <button className="h-11 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Save task update</button>
        </form>
      </CardBody>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function ProjectsView(data: AppData) {
  return (
    <Page>
      <DataToolbar tabs={["All", "Active", "Review", "Completed"]} />
      <div className="grid gap-4 lg:grid-cols-3">
        {data.projects.map((project) => (
          <Card key={project.project_id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{project.project_name}</p>
                  <p className="mt-1 text-sm text-slate-500">Owner: {userName(data.users, project.owner_user_id)}</p>
                </div>
                <StatusPill status={project.status} />
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="line-clamp-3 text-sm leading-6 text-slate-600">{project.description}</p>
              <Progress value={clampProgress(project.progress)} label={`Deadline ${formatShortDate(project.deadline)}`} />
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {project.members.slice(0, 4).map((id) => (
                    <Avatar key={id} name={userName(data.users, id)} size="sm" />
                  ))}
                </div>
                <Badge tone={project.priority === "Urgent" ? "red" : project.priority === "High" ? "yellow" : "neutral"}>{project.priority}</Badge>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </Page>
  );
}

export function CalendarView(data: AppData) {
  const grouped = groupBy(data.calendarEvents, (event) => event.start_date.slice(0, 10));

  return (
    <Page>
      <DataToolbar tabs={["Month", "Week", "Day"]} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <SectionTitle title="Categories" />
          </CardHeader>
          <CardBody className="grid gap-2">
            {["Birthday", "Task", "Deadline", "Announcement", "Meeting", "Leave", "Project Milestone"].map((type) => (
              <label key={type} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                <span>{type}</span>
                <input defaultChecked type="checkbox" className="h-4 w-4 accent-slate-950" />
              </label>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Live monthly calendar" action={<Badge tone="blue">{data.calendarEvents.length} events</Badge>} />
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(grouped).map(([date, events]) => (
                <div key={date} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-950">{formatDate(date)}</p>
                  <div className="mt-3 space-y-2">
                    {events.map((event) => (
                      <div key={event.event_id} className="rounded-lg bg-slate-50 p-3">
                        <Badge tone={statusTone(event.type)}>{event.type}</Badge>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{event.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{event.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}

export function AttendanceView(data: AppData & { canApproveLeave: boolean }) {
  const todayRecord = getTodayAttendance(data.attendance, data.currentUser.user_id);
  const clockStatus = getClockStatus(todayRecord);
  const weekRange = currentWeekRange();
  const pendingRequests = pendingLeaveRequests(data.leaveRequests, data.canApproveLeave ? { approverView: true } : { userId: data.currentUser.user_id });

  return (
    <Page>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Clock status" value={clockStatus.value} detail={clockStatus.detail} icon={Clock3} />
        <MetricCard
          label="Late records"
          value={String(attendanceLateCount(data.attendance, weekRange))}
          detail={`Team late days this week (${weekRange.start} to ${weekRange.end})`}
          icon={AlarmClock}
          tone="yellow"
        />
        <MetricCard
          label="Requests"
          value={String(pendingRequests.length)}
          detail={data.canApproveLeave ? "Awaiting your approval" : "Your pending leave requests"}
          icon={CalendarCheck}
          tone="blue"
        />
      </div>

      {data.canApproveLeave && pendingRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <SectionTitle
              title="Leave requests to review"
              action={
                <Link href="/attendance/request" className="text-sm font-semibold text-blue-600">
                  Open queue
                </Link>
              }
            />
          </CardHeader>
          <CardBody className="space-y-3">
            {pendingRequests.map((request) => (
              <LeaveRequestCard key={request.request_id} request={request} users={data.users} canApprove={data.canApproveLeave} />
            ))}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <SectionTitle title="Today actions" />
          </CardHeader>
          <CardBody className="space-y-3">
            <form action="/api/attendance/clock" method="post">
              <input type="hidden" name="action" value="clock_in" />
              <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                <Clock3 className="h-4 w-4" />
                Clock in
              </button>
            </form>
            <form action="/api/attendance/clock" method="post">
              <input type="hidden" name="action" value="clock_out" />
              <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300">
                <CheckCircle2 className="h-4 w-4" />
                Clock out
              </button>
            </form>
            <Link href="/attendance/request" className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700">
              <Plus className="h-4 w-4" />
              Request leave
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Attendance history" action={<button className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"><Download className="h-4 w-4" /> Export</button>} />
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <DataTable
              headers={["Employee", "Date", "Clock in", "Clock out", "Status", "Approval"]}
              rows={data.attendance.map((item) => [
                userName(data.users, item.user_id),
                formatDate(item.date),
                item.clock_in || "-",
                item.clock_out || "-",
                <StatusPill key="status" status={item.status} />,
                item.approval_status,
              ])}
            />
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}

export function LeaveRequestView(data: AppData & { canApproveLeave: boolean }) {
  const pendingRequests = data.leaveRequests.filter((request) => request.status === "Pending Approval");
  const myRequests = data.leaveRequests.filter((request) => request.user_id === data.currentUser.user_id);
  const queueTitle = data.canApproveLeave ? "Approval queue" : "My requests";
  const queueItems = data.canApproveLeave ? data.leaveRequests : myRequests;

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <SectionTitle title="Submit request" />
        </CardHeader>
        <CardBody>
          <form action="/api/resources/Leave_Requests" method="post" encType="multipart/form-data" className="space-y-4">
            <input type="hidden" name="user_id" value={data.currentUser.user_id} />
            <Field label="Type">
              <select name="request_type" className="input">
                {["Izin", "Sick", "Cuti", "WFH", "Half Day"].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Start"><input name="start_date" type="date" required className="input" /></Field>
              <Field label="End"><input name="end_date" type="date" required className="input" /></Field>
            </div>
            <Field label="Reason"><textarea name="reason" required className="input min-h-28 resize-y" /></Field>
            <Field label="Attachment">
              <input name="attachment_url" type="url" className="input" placeholder="https://" />
              <input name="attachment_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="input" />
            </Field>
            <button className="h-11 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Submit request</button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle
            title={queueTitle}
            action={
              data.canApproveLeave ? (
                <Badge tone={pendingRequests.length > 0 ? "yellow" : "green"}>{pendingRequests.length} pending</Badge>
              ) : null
            }
          />
        </CardHeader>
        <CardBody className="space-y-3">
          {queueItems.length === 0 ? (
            <EmptyState label={data.canApproveLeave ? "No leave requests yet." : "You have not submitted any leave requests."} />
          ) : (
            queueItems.map((request) => (
              <LeaveRequestCard key={request.request_id} request={request} users={data.users} canApprove={data.canApproveLeave} />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export function AnnouncementsView(data: AppData & { canManage: boolean }) {
  const visibleAnnouncements = announcementsForUser(data.announcements, data.currentUser);
  const pinnedCount = visibleAnnouncements.filter((announcement) => announcement.is_pinned).length;

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <Card>
        <CardHeader>
          <SectionTitle title="Company feed" action={<Badge tone="blue">{visibleAnnouncements.length} posts</Badge>} />
        </CardHeader>
        <CardBody className="space-y-4">
          {visibleAnnouncements.map((announcement) => (
            <article key={announcement.announcement_id} className="rounded-lg border border-slate-200 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={announcement.is_pinned ? "yellow" : "blue"}>{announcement.category}</Badge>
                {announcement.is_pinned ? <Badge tone="neutral">Pinned</Badge> : null}
                <span className="text-xs font-medium text-slate-400">{formatDate(announcement.scheduled_at)}</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-normal text-slate-950">{announcement.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{announcement.body}</p>
              <p className="mt-4 text-xs font-semibold text-slate-500">By {userName(data.users, announcement.created_by)}</p>
            </article>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle title={data.canManage ? "Create announcement" : "Read status"} />
        </CardHeader>
        <CardBody>
          {data.canManage ? (
            <form action="/api/resources/Announcements" method="post" className="space-y-4">
              <input type="hidden" name="created_by" value={data.currentUser.user_id} />
              <Field label="Title"><input name="title" required className="input" /></Field>
              <Field label="Category"><select name="category" className="input">{["General", "HR", "Task", "Event", "Birthday", "Important", "Policy", "Reminder"].map((category) => <option key={category}>{category}</option>)}</select></Field>
              <Field label="Body"><textarea name="body" required className="input min-h-28" /></Field>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input name="is_pinned" type="checkbox" className="h-4 w-4 accent-slate-950" /> Pin important announcement</label>
              <button className="h-11 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Publish</button>
            </form>
          ) : (
            <div className="space-y-3">
              <InfoTile label="Visible posts" value={`${visibleAnnouncements.length} announcement${visibleAnnouncements.length === 1 ? "" : "s"}`} />
              <InfoTile label="Pinned" value={`${pinnedCount} pinned`} />
              <InfoTile label="Latest update" value={latestAnnouncementLabel(visibleAnnouncements)} />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export function EmployeesView(data: AppData) {
  const employees = directoryUsers(data.users);
  const activeEmployeeCount = activeUsers(data.users).length;
  const birthdayCount = upcomingBirthdays(data.users, 30).length;

  return (
    <Page>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Active employees" value={String(activeEmployeeCount)} detail={`${employees.length} in directory`} icon={Users} />
        <MetricCard label="Departments" value={String(data.departments.length)} detail="Leader assigned teams" icon={ShieldCheck} tone="blue" />
        <MetricCard label="Birthdays" value={String(birthdayCount)} detail="Upcoming in the next 30 days" icon={Cake} tone="yellow" />
      </div>
      <Card>
        <CardHeader>
          <SectionTitle title="Employee directory" action={<Link href="/invite" className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Invite</Link>} />
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <DataTable
            headers={["Name", "Department", "Position", "Status", "Role", "Performance"]}
            rows={employees.map((user) => [
              <Link key="name" href={`/employees/${user.user_id}`} className="flex items-center gap-3 font-semibold text-slate-950"><Avatar name={user.full_name} size="sm" /> {user.full_name}</Link>,
              departmentName(data.departments, user.department_id),
              user.position,
              <StatusPill key="status" status={user.employment_status} />,
              data.roles.find((role) => role.role_id === user.role_id)?.role_name ?? user.role_id,
              String(scoreForUser(data.points, user.user_id)),
            ])}
          />
        </CardBody>
      </Card>
    </Page>
  );
}

export function EmployeeProfileView({ data, employee }: { data: AppData; employee: User }) {
  const employeeTasks = visibleTasksForUser(data.tasks, employee.user_id);
  const employeeAttendance = data.attendance.filter((item) => item.user_id === employee.user_id);
  const employeeDoneTasks = completedTasks(employeeTasks);
  const weekAttendanceRate = userAttendanceRateThisWeek(data.attendance, employee.user_id);
  const score = scoreForUser(data.points, employee.user_id);
  const canManageEmployees = data.currentUser.role.permissions_json.includes("employees:manage");

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-col items-center text-center">
            <Avatar name={employee.full_name} image={employee.profile_photo} size="lg" />
            <h2 className="mt-4 break-words text-xl font-semibold tracking-normal text-slate-950">{employee.full_name}</h2>
            <p className="text-sm text-slate-500">{employee.position}</p>
          </div>
          <div className="grid gap-3">
            <InfoTile label="Department" value={departmentName(data.departments, employee.department_id)} />
            <InfoTile label="Role" value={data.roles.find((role) => role.role_id === employee.role_id)?.role_name ?? employee.role_id} />
            <InfoTile label="Account" value={employee.is_active ? "Active" : "Inactive"} />
            <InfoTile label="Birthday" value={formatDate(employee.birthday)} />
            <InfoTile label="Join date" value={formatDate(employee.join_date)} />
          </div>
        </CardBody>
      </Card>

      <div className="min-w-0 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Performance score" value={String(score)} detail="All-time points" icon={Trophy} tone="yellow" />
          <MetricCard label="Assigned tasks" value={String(employeeTasks.length)} detail={`${employeeDoneTasks.length} completed`} icon={CheckSquare} />
          <MetricCard label="Attendance this week" value={`${weekAttendanceRate}%`} detail={`${employeeAttendance.length} records on file`} icon={CalendarCheck} tone="green" />
        </div>
        <Card>
          <CardHeader>
            <SectionTitle title="Task history" />
          </CardHeader>
          <CardBody className="space-y-3">
            {employeeTasks.map((task) => (
              <TaskCard key={task.task_id} task={task} users={data.users} compact />
            ))}
          </CardBody>
        </Card>
        {canManageEmployees ? (
          <Card>
            <CardHeader>
              <SectionTitle title="Admin controls" />
            </CardHeader>
            <CardBody className="space-y-4">
              <form action={`/api/resources/Users/${employee.user_id}`} method="post" encType="multipart/form-data" className="grid gap-4 md:grid-cols-2">
                <Field label="Full name">
                  <input name="full_name" required className="input" defaultValue={employee.full_name} />
                </Field>
                <Field label="Email">
                  <input name="email" required type="email" className="input" defaultValue={employee.email} />
                </Field>
                <Field label="Position">
                  <input name="position" required className="input" defaultValue={employee.position} />
                </Field>
                <Field label="Department">
                  <select name="department_id" className="input" defaultValue={employee.department_id}>
                    {data.departments.map((department) => (
                      <option key={department.department_id} value={department.department_id}>
                        {department.department_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Role">
                  <select name="role_id" className="input" defaultValue={employee.role_id}>
                    {data.roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Employment status">
                  <select name="employment_status" className="input" defaultValue={employee.employment_status}>
                    {employeeStatusOptions.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Account status">
                  <select name="is_active" className="input" defaultValue={String(employee.is_active)}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </Field>
                <Field label="Profile photo">
                  <input name="profile_photo" type="url" className="input" defaultValue={employee.profile_photo} />
                  <input name="profile_photo_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="input" />
                </Field>
                <Field label="Bio">
                  <textarea name="bio" className="input" rows={4} defaultValue={employee.bio} />
                </Field>
                <div className="flex items-end">
                  <button className="h-11 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">Save user</button>
                </div>
              </form>

              {employee.user_id !== data.currentUser.user_id ? (
                <form action={`/api/resources/Users/${employee.user_id}`} method="post">
                  <input type="hidden" name="_method" value="delete" />
                  <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 md:w-auto">
                    <Trash2 className="h-4 w-4" />
                    Remove user account
                  </button>
                </form>
              ) : (
                <p className="text-sm font-medium text-slate-500">You cannot remove your own account while signed in.</p>
              )}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export function LeaderboardView(data: AppData) {
  const rows = leaderboardRows(data);
  const podium = [rows[1], rows[0], rows[2]].filter(Boolean);

  return (
    <Page>
      <DataToolbar tabs={["Weekly", "Monthly", "All-time", "Department"]} />
      <Card>
        <CardBody>
          <div className="grid items-end gap-4 md:grid-cols-3">
            {podium.map((row) => {
              const rank = row === rows[0] ? 1 : row === rows[1] ? 2 : 3;
              return (
                <div key={row.user.user_id} className={cn("rounded-lg border border-slate-200 bg-white p-5 text-center", rank === 1 && "md:order-2", rank === 2 && "md:order-1", rank === 3 && "md:order-3")}>
                  <div className="mx-auto flex w-fit flex-col items-center">
                    <div className={cn("mb-3 flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold", rank === 1 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700")}>
                      <Crown className="h-4 w-4" />
                      Rank {rank}
                    </div>
                    <Avatar name={row.user.full_name} size="lg" />
                    <p className="mt-3 font-semibold text-slate-950">{row.user.full_name}</p>
                    <p className="text-sm text-slate-500">{row.badges[0]?.badge_name ?? "Team Player"}</p>
                    <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-normal text-slate-950">{row.points}</p>
                  </div>
                  <div className={cn("mt-5 rounded-lg", rank === 1 ? "h-28 bg-amber-300" : rank === 2 ? "h-20 bg-slate-200" : "h-16 bg-blue-200")} />
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle title="Full ranking" />
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <DataTable
            headers={["Rank", "Name", "Department", "Points", "Badge"]}
            rows={rows.map((row, index) => [
              index + 1,
              <span key="name" className="flex items-center gap-3 font-semibold text-slate-950"><Avatar name={row.user.full_name} size="sm" /> {row.user.full_name}</span>,
              departmentName(data.departments, row.user.department_id),
              row.points,
              row.badges[0]?.badge_name ?? "Team Player",
            ])}
          />
        </CardBody>
      </Card>
    </Page>
  );
}

export function NotificationsView(data: AppData) {
  const myNotifications = data.notifications
    .filter((notification) => notification.user_id === data.currentUser.user_id)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const unreadCount = myNotifications.filter((notification) => !notification.is_read).length;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <SectionTitle
          title="Notification history"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {unreadCount > 0 ? <Badge tone="yellow">{unreadCount} unread</Badge> : <Badge tone="green">All read</Badge>}
              <MarkAllNotificationsReadButton
                disabled={unreadCount === 0}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          }
        />
      </CardHeader>
      <CardBody className="space-y-3">
        {myNotifications.length === 0 ? (
          <EmptyState label="No notifications yet." />
        ) : (
          myNotifications.map((notification) => (
            <NotificationLink
              key={notification.notification_id}
              notification={notification}
              href={notification.related_link || "/dashboard"}
              className={cn("flex gap-3 rounded-lg border p-4 transition hover:bg-slate-50", notification.is_read ? "border-slate-200" : "border-blue-200 bg-blue-50")}
            >
              <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                <Bell className="h-4 w-4" />
                {!notification.is_read ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" aria-hidden="true" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{notification.title}</p>
                  {!notification.is_read ? <Badge tone="blue">Unread</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">{notification.description}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">{formatDate(notification.created_at, { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </NotificationLink>
          ))
        )}
      </CardBody>
    </Card>
  );
}

export function AdminView(data: AppData) {
  const pendingRequests = data.users.filter((user) => user.signup_status === "pending" || user.signup_status === "approved");
  const activeEmployeeCount = activeUsers(data.users).length;
  const completionRate = taskCompletionRate(data.tasks);
  const lateTasks = data.tasks.filter((task) => task.status === "Late").length;
  const pendingLeave = pendingLeaveRequests(data.leaveRequests, { approverView: true }).length;

  return (
    <Page>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total users" value={String(directoryUsers(data.users).length)} detail="Registered accounts" icon={Users} />
        <MetricCard label="Active employees" value={String(activeEmployeeCount)} detail="Currently active" icon={Activity} tone="green" />
        <MetricCard label="Completion rate" value={percent(completionRate)} detail={data.tasks.length === 0 ? "No tasks yet" : `${completedTasks(data.tasks).length} of ${data.tasks.length} tasks done`} icon={Gauge} tone="blue" />
        <MetricCard label="Late tasks" value={String(lateTasks)} detail={pendingLeave > 0 ? `${pendingLeave} leave requests pending` : "Needs attention"} icon={AlarmClock} tone="yellow" />
      </div>
      <Card>
        <CardHeader>
          <SectionTitle title="Account requests" action={<Badge tone={pendingRequests.length > 0 ? "yellow" : "green"}>{pendingRequests.length} pending</Badge>} />
        </CardHeader>
        <CardBody className="space-y-3">
          {pendingRequests.length === 0 ? (
            <EmptyState label="No pending account requests." />
          ) : (
            pendingRequests.map((user) => (
              <div key={user.user_id} className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{user.full_name}</p>
                    <Badge tone={user.signup_status === "approved" ? "blue" : "yellow"}>{user.signup_status}</Badge>
                    <Badge>{user.signup_provider || "password"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                  {user.bio ? <p className="mt-2 text-sm text-slate-500">{user.bio}</p> : null}
                  <p className="mt-2 text-xs font-medium text-slate-400">
                    Requested {user.requested_at ? formatDate(user.requested_at, { hour: "2-digit", minute: "2-digit" }) : "recently"}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-80">
                  <form action={`/api/admin/account-requests/${user.user_id}`} method="post">
                    <input type="hidden" name="intent" value="approve" />
                    <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Allow
                    </button>
                  </form>
                  <form action={`/api/admin/account-requests/${user.user_id}`} method="post" className="grid gap-2">
                    <input type="hidden" name="intent" value="reject" />
                    <input name="rejection_reason" className="input" placeholder="Reason" />
                    <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50">
                      <XCircle className="h-4 w-4" />
                      Disallow
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <ActivityFeed logs={data.activityLogs} users={data.users} />
        <Card>
          <CardHeader>
            <SectionTitle title="System settings" />
          </CardHeader>
          <CardBody className="space-y-3">
            <InfoTile label="Data source" value={dataSourceLabel()} />
            <InfoTile label="PWA" value="Manifest, service worker, offline page" />
            <InfoTile label="Security" value="HTTP-only session cookie and server RBAC" />
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}

function ActivityFeed({ logs, users }: { logs: ActivityLog[]; users: User[] }) {
  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Recent activity" />
      </CardHeader>
      <CardBody className="space-y-3">
        {logs.map((log) => (
          <div key={log.log_id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-slate-950">{log.description}</p>
              <p className="mt-1 text-xs text-slate-500">{userName(users, log.user_id)} - {formatDate(log.created_at, { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export function SettingsView(data: AppData) {
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <Card>
        <CardHeader>
          <SectionTitle title="CMS settings" />
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <DataTable
            headers={["Key", "Value", "Type", "Updated"]}
            rows={data.settings.map((setting) => [setting.setting_key, setting.setting_value, setting.setting_type, formatDate(setting.updated_at)])}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <SectionTitle title="Database connection" />
        </CardHeader>
        <CardBody className="space-y-3">
          <InfoTile label="Source" value={dataSourceLabel()} />
          <InfoTile label="Supabase URL" value={supabaseConfigLabel()} />
          <InfoTile label="Supabase secret" value={supabaseSecretLabel()} />
          {process.env.ATM_DATA_MODE !== "supabase" ? (
            <form action="/api/admin/migrate-supabase" method="post">
              <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                Migrate current data to Supabase
              </button>
            </form>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

export function DepartmentsManagerView(data: AppData) {
  const usersByDepartment = groupBy(data.users, (user) => user.department_id || "unassigned");

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <SectionTitle title="Add department" />
        </CardHeader>
        <CardBody>
          <form action="/api/resources/Departments" method="post" className="space-y-4">
            <Field label="Department name">
              <input name="department_name" required className="input" placeholder="Creative Team" />
            </Field>
            <Field label="Leader">
              <select name="leader_user_id" className="input" defaultValue="">
                <option value="">No leader assigned</option>
                {data.users
                  .filter((user) => user.is_active)
                  .map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.full_name}
                    </option>
                  ))}
              </select>
            </Field>
            <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
              <Plus className="h-4 w-4" />
              Add department
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle title="Departments" />
        </CardHeader>
        <CardBody className="space-y-3">
          {data.departments.length === 0 ? (
            <EmptyState label="No departments yet." />
          ) : (
            data.departments.map((department) => {
              const memberCount = usersByDepartment[department.department_id]?.length ?? 0;

              return (
                <div key={department.department_id} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{department.department_name}</p>
                        <p className="text-xs font-medium text-slate-500">
                          {memberCount} member{memberCount === 1 ? "" : "s"} · ID <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-700">{department.department_id}</code>
                        </p>
                      </div>
                    </div>
                    <Badge tone={memberCount > 0 ? "blue" : "neutral"}>{userName(data.users, department.leader_user_id)}</Badge>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                    <form action={`/api/resources/Departments/${department.department_id}`} method="post" className="contents">
                      <Field label="Name">
                        <input name="department_name" required className="input" defaultValue={department.department_name} />
                      </Field>
                      <Field label="Leader">
                        <select name="leader_user_id" className="input" defaultValue={department.leader_user_id}>
                          <option value="">No leader assigned</option>
                          {data.users
                            .filter((user) => user.is_active)
                            .map((user) => (
                              <option key={user.user_id} value={user.user_id}>
                                {user.full_name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <div className="flex items-end gap-2">
                        <button className="h-11 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                          Save
                        </button>
                      </div>
                    </form>

                    <form action={`/api/resources/Departments/${department.department_id}`} method="post" className="lg:col-start-3">
                      <input type="hidden" name="_method" value="delete" />
                      <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 lg:w-auto">
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export function RolesView(data: AppData) {
  const permissions = Array.from(new Set(data.roles.flatMap((role) => role.permissions_json)));
  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Permission matrix" />
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-3 py-3 font-semibold text-slate-500">Permission</th>
              {data.roles.map((role) => (
                <th key={role.role_id} className="px-3 py-3 text-center font-semibold text-slate-500">{role.role_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 border-t border-slate-100 bg-white px-3 py-3 font-medium text-slate-700">{permission}</td>
                {data.roles.map((role) => (
                  <td key={role.role_id} className="border-t border-slate-100 px-3 py-3 text-center">
                    {role.permissions_json.includes(permission) ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" /> : <span className="text-slate-300">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

export function AttendanceSettingsView(data: AppData) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card>
        <CardHeader><SectionTitle title="Work rules" /></CardHeader>
        <CardBody className="space-y-3">
          <Field label="Official clock-in"><input className="input" defaultValue={data.settings.find((setting) => setting.setting_key === "official_clock_in")?.setting_value} /></Field>
          <Field label="Official clock-out"><input className="input" defaultValue={data.settings.find((setting) => setting.setting_key === "official_clock_out")?.setting_value} /></Field>
          <Field label="Grace period"><input className="input" defaultValue={data.settings.find((setting) => setting.setting_key === "grace_period_minutes")?.setting_value} /></Field>
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><SectionTitle title="Approval statuses" /></CardHeader>
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {attendanceStatuses.map((status) => <StatusPill key={status} status={status} />)}
        </CardBody>
      </Card>
    </div>
  );
}

export function GamificationSettingsView(data: AppData) {
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader><SectionTitle title="Point rules" /></CardHeader>
        <CardBody className="space-y-3">
          {["Completing tasks", "Before deadline", "Helpful comments", "Good attendance", "Late task deduction", "Rejected task deduction"].map((rule, index) => (
            <div key={rule} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-semibold text-slate-700">{rule}</span>
              <Badge tone={index > 3 ? "red" : "green"}>{index > 3 ? "-" : "+"}{[50, 25, 10, 15, 20, 30][index]}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><SectionTitle title="Badges" /></CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          {data.badges.map((badge) => (
            <div key={badge.badge_id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <p className="font-semibold text-slate-950">{badge.badge_name}</p>
              </div>
              <p className="mt-2 text-sm text-slate-500">{badge.description}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

export function InviteView(data: AppData) {
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader><SectionTitle title="Invite employee" /></CardHeader>
        <CardBody>
          <form action="/api/resources/Users" method="post" encType="multipart/form-data" className="space-y-4">
            <Field label="Full name"><input name="full_name" required className="input" /></Field>
            <Field label="Email"><input name="email" required type="email" className="input" /></Field>
            <Field label="Password"><input name="password" required minLength={8} type="password" className="input" autoComplete="new-password" /></Field>
            <Field label="Profile photo">
              <input name="profile_photo" type="url" className="input" placeholder="https://..." />
              <input name="profile_photo_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="input" />
            </Field>
            <Field label="Phone"><input name="phone" className="input" /></Field>
            <Field label="Position"><input name="position" required className="input" /></Field>
            <Field label="Bio"><textarea name="bio" className="input" rows={4} /></Field>
            <Field label="Department"><select name="department_id" className="input">{data.departments.map((department) => <option key={department.department_id} value={department.department_id}>{department.department_name}</option>)}</select></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Role"><select name="role_id" className="input">{data.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.role_name}</option>)}</select></Field>
              <Field label="Status"><select name="employment_status" className="input">{employeeStatusOptions.map((status) => <option key={status}>{status}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Birthday"><input name="birthday" type="date" className="input" /></Field>
              <Field label="Join date"><input name="join_date" type="date" className="input" /></Field>
            </div>
            <button className="h-11 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Create invite</button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><SectionTitle title="Role defaults" /></CardHeader>
        <CardBody className="space-y-3">
          {data.roles.map((role) => (
            <div key={role.role_id} className="rounded-lg border border-slate-200 p-4">
              <p className="font-semibold text-slate-950">{role.role_name}</p>
              <p className="mt-1 text-sm text-slate-500">{role.description}</p>
              <p className="mt-3 text-xs font-semibold text-blue-600">{role.permissions_json.length} permissions</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0">
    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-500">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className={cn(
                  "border-b border-slate-100 px-3 py-3 align-middle text-slate-700",
                  isNumericDisplay(cell) && "font-mono tabular-nums",
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export function StatusCatalogView() {
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><SectionTitle title="Task statuses" /></CardHeader>
        <CardBody className="flex flex-wrap gap-2">{taskStatuses.map((status) => <StatusPill key={status} status={status} />)}</CardBody>
      </Card>
      <Card>
        <CardHeader><SectionTitle title="Project statuses" /></CardHeader>
        <CardBody className="flex flex-wrap gap-2">{projectStatuses.map((status) => <StatusPill key={status} status={status} />)}</CardBody>
      </Card>
    </div>
  );
}
