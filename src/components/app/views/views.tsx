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
  ExternalLink,
  Filter,
  FolderOpen,
  Gauge,
  GitBranch,
  MessageCircle,
  Paperclip,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import styles from "./views.module.css";

import { ActivityFeed } from "@/components/app/activity-feed";
import { AnnouncementCreateForm } from "@/components/app/announcement-create-form";
import { CreateTaskModal } from "@/components/app/create-task-modal";
import { CreateProjectModal } from "@/components/app/create-project-modal";
import { TaskUpdatePanel } from "@/components/app/task-update-panel";
import { ProjectFileForm } from "@/components/app/project-file-form";
import { DRIVE_FOLDER_MIME } from "@/hooks/useDriveUpload";
import { WorkflowChecklistItem } from "@/components/app/workflow-checklist-item";
import { EmployeeAdminControls } from "@/components/app/employee-admin-controls";
import { AttendanceTerminal } from "@/components/app/attendance-terminal";
import { MarkAllNotificationsReadButton, NotificationLink } from "@/components/app/notification-actions";
import { Page } from "@/components/app/page-layout";
import { TaskWorkspace } from "@/components/app/task-workspace";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { MetricCard } from "@/components/ui/metric-card";
import { Progress } from "@/components/ui/progress";
import { StatusPill, TaskStatusPill, statusTone } from "@/components/ui/status-pill";
import dashStyles from "./dashboard.module.css";
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
import { attendanceStatuses, canApproveTaskAsLeader, employeeStatusOptions, hasPermission, projectStatuses, taskStatuses } from "@/lib/permissions";
import { visibleTaskLabels } from "@/lib/task-approval";
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
  ProjectFile,
  Role,
  Setting,
  Task,
  TaskChecklist,
  TaskComment,
  User,
  UserBadge,
  Workflow,
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
  projectFiles: ProjectFile[];
  projects: Project[];
  workflows: Workflow[];
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

function formatActiveMinutes(minutes: number) {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
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

function canManageLeaderboardScore(user: CurrentUser) {
  return user.role_id === "super_admin" || user.role_id === "admin" || user.employment_status === "Manager";
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className={styles.title}>
      <h2 className={styles.wssectiontitle}>{title}</h2>
      {action ? <div className={styles.emptystate}>{action}</div> : null}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="ws-empty">{label}</div>;
}

function TicketId({ id }: { id: string }) {
  return <code className={styles.empty}>#{id}</code>;
}

function BoardStage({ status, dueDate, handedOffAt }: { status: Task["status"]; dueDate?: string; handedOffAt?: string }) {
  return (
    <div className={styles.boardstage}>
      <span className="ws-eyebrow">Board stage</span>
      <div className={styles.body}>
        {dueDate ? <span className={styles.header}>Due {formatShortDate(dueDate)}</span> : null}
        <TaskStatusPill status={status} dueDate={dueDate} handedOffAt={handedOffAt} />
      </div>
    </div>
  );
}

function LeaveApprovalActions({ requestId, canApprove, status }: { requestId: string; canApprove: boolean; status: string }) {
  if (!canApprove || status !== "Pending Approval") return null;

  return (
    <div className={styles.leaveapprovalactions}>
      <form action={`/api/admin/leave-requests/${requestId}`} method="post" className={styles.form}>
        <input type="hidden" name="intent" value="approve" />
        <input name="approval_note" className="input" placeholder="Approval note (optional)" />
        <Button type="submit" variant="default" size="xl" className={styles.button}>
          <CheckCircle2 className={styles.icon} />
          Approve
        </Button>
      </form>
      <form action={`/api/admin/leave-requests/${requestId}`} method="post" className={styles.form}>
        <input type="hidden" name="intent" value="reject" />
        <input name="approval_note" className="input" placeholder="Reason for rejection" />
        <Button type="submit" variant="destructiveOutline" size="xl" className={styles.button}>
          <XCircle className={styles.icon} />
          Reject
        </Button>
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
    <div className={styles.wsrow}>
      <div className={styles.leaverequest}>
        <div>
          <p className={styles.itemMeta}>{userName(users, request.user_id)}</p>
          <p className={styles.text}>
            {request.request_type} from {formatShortDate(request.start_date)} to {formatShortDate(request.end_date)}
          </p>
        </div>
        <StatusPill status={request.status} />
      </div>
      <p className={styles.textP}>{request.reason}</p>
      {request.attachment_url ? (
        <a href={request.attachment_url} target="_blank" rel="noreferrer" className={styles.link}>
          View attachment
        </a>
      ) : null}
      {request.approval_note ? (
        <p className={styles.hint}>
          <span className={styles.itemMeta}>{request.status === "Approved" ? "Approval note" : "Rejection note"}:</span> {request.approval_note}
          {approverName ? <span className={styles.caption}>By {approverName}</span> : null}
        </p>
      ) : null}
      <LeaveApprovalActions requestId={request.request_id} canApprove={canApprove} status={request.status} />
    </div>
  );
}

function DataToolbar({ tabs, action }: { tabs: string[]; action?: React.ReactNode }) {
  return (
    <div className="ws-toolbar">
      <Tabs labels={tabs} aria-label="Data view" />
      <div className={styles.dataView}>
        <Button type="button" variant="outline" size="lg" className={styles.viewRoot}>
          <Filter className={styles.icon} />
          Filter
        </Button>
        {action}
      </div>
    </div>
  );
}

function DashboardPinnedUpdates({ data }: { data: AppData }) {
  const pinnedAnnouncements = announcementsForUser(data.announcements, data.currentUser)
    .filter((announcement) => announcement.is_pinned)
    .sort((left, right) => right.scheduled_at.localeCompare(left.scheduled_at))
    .slice(0, 2);

  if (pinnedAnnouncements.length === 0) return null;

  return (
    <div className={dashStyles.pinned}>
      {pinnedAnnouncements.map((announcement) => (
        <Link key={announcement.announcement_id} href="/announcements" className={dashStyles.pinnedItem}>
          <Badge tone={announcement.category === "Important" ? "yellow" : "blue"}>{announcement.category}</Badge>
          <div className={styles.card}>
            <p className={dashStyles.pinnedTitle}>{announcement.title}</p>
            <p className={dashStyles.pinnedMeta}>{formatDate(announcement.scheduled_at)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function DashboardSectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className={dashStyles.sectionTitle}>
      <h2 className={dashStyles.sectionTitleText}>{title}</h2>
      {action ? <div className={styles.emptystate}>{action}</div> : null}
    </div>
  );
}

function attendanceClockTone(value: string): "green" | "yellow" | "neutral" {
  if (value === "Active") return "green";
  if (value === "Complete") return "yellow";
  return "neutral";
}

export function DashboardView(data: AppData) {
  const myTasks = visibleTasksForUser(data.tasks, data.currentUser.user_id);
  const myActiveTasks = activeTasks(myTasks);
  const myCompletedTasks = completedTasks(myTasks);
  const dueToday = tasksDueOnDate(myActiveTasks, jakartaToday());
  const todayTaskList = dueToday.length > 0 ? dueToday : myActiveTasks.slice(0, 5);
  const canApproveLeave = hasPermission(data.currentUser.role_id, "attendance:approve");
  const pendingApprovals = pendingLeaveRequests(data.leaveRequests, canApproveLeave ? { approverView: true } : { userId: data.currentUser.user_id });
  const attendanceRate = teamAttendanceRateThisWeek(data.attendance, data.users);
  const weekRange = currentWeekRange();
  const unread = data.notifications.filter((notification) => notification.user_id === data.currentUser.user_id && !notification.is_read);
  const teamAttendance = activeUsers(data.users)
    .map((user) => {
      const record = getTodayAttendance(data.attendance, user.user_id);
      const clock = getClockStatus(record);
      return { user, record, clock };
    })
    .slice(0, 8);
  const latestAnnouncements = announcementsForUser(data.announcements, data.currentUser)
    .sort((left, right) => {
      if (left.is_pinned !== right.is_pinned) return left.is_pinned ? -1 : 1;
      return right.scheduled_at.localeCompare(left.scheduled_at);
    })
    .slice(0, 3);
  const recentActivity = [...data.activityLogs].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 8);
  const firstName = data.currentUser.full_name.split(" ")[0] || data.currentUser.full_name;

  return (
    <div className={dashStyles.page}>
      <section className={dashStyles.hero}>
        <div>
          <p className={dashStyles.heroEyebrow}>Today at Akaal</p>
          <h1 className={dashStyles.heroTitle}>Welcome back, {firstName}</h1>
          <p className={dashStyles.heroText}>
            {dueToday.length} due today Â· {pendingApprovals.length} approvals Â· {unread.length} unread
          </p>
        </div>
        <div className={dashStyles.heroMeta}>
          <Link href="/tasks/my" className={dashStyles.heroChip}>
            My tasks
          </Link>
          <Link href="/attendance" className={dashStyles.heroChip}>
            Attendance
          </Link>
          <Link href="/announcements" className={dashStyles.heroChip}>
            Announcements
          </Link>
        </div>
      </section>

      <DashboardPinnedUpdates data={data} />

      <div className={dashStyles.metrics}>
        <MetricCard
          label="Active tasks"
          value={String(myActiveTasks.length)}
          detail={`${dueToday.length} due today Â· ${myCompletedTasks.length} completed`}
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

      <div className={dashStyles.mainGrid}>
        <Card>
          <CardHeader>
            <DashboardSectionTitle
              title="Today's tasks"
              action={
                <Link href="/tasks/my" className={dashStyles.sectionLink}>
                  Open tasks
                </Link>
              }
            />
          </CardHeader>
          <CardBody flush>
            {todayTaskList.length === 0 ? (
              <p className={dashStyles.empty}>No tasks due today.</p>
            ) : (
              todayTaskList.slice(0, 5).map((task) => (
                <article key={task.task_id} className={dashStyles.taskRow}>
                  <div className={dashStyles.taskTop}>
                    <div className={dashStyles.taskMeta}>
                      <span className={dashStyles.taskId}>#{task.task_id}</span>
                      <div>
                        <Link href={`/tasks/${task.task_id}`} className={dashStyles.taskTitle}>
                          {task.title}
                        </Link>
                        <LinkifiedText text={task.description} className={dashStyles.taskDesc} />
                      </div>
                    </div>
                  </div>
                  <div className={dashStyles.stageBar}>
                    <span className={dashStyles.stageLabel}>Status</span>
                    <div className={styles.body}>
                      {task.due_date ? <span className={styles.header}>Due {formatShortDate(task.due_date)}</span> : null}
                      <TaskStatusPill status={task.status} dueDate={task.due_date} handedOffAt={task.handed_off_at} />
                    </div>
                  </div>
                </article>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <DashboardSectionTitle
              title="Team attendance"
              action={
                <Link href="/attendance" className={dashStyles.sectionLink}>
                  View all
                </Link>
              }
            />
          </CardHeader>
          <CardBody flush>
            {teamAttendance.length === 0 ? (
              <p className={dashStyles.empty}>No team members to show.</p>
            ) : (
              teamAttendance.map(({ user, record, clock }) => (
                <div key={user.user_id} className={dashStyles.attendRow}>
                  <Avatar name={user.full_name} image={user.profile_photo} size="sm" />
                  <div className={styles.content}>
                    <p className={dashStyles.attendName}>{user.full_name}</p>
                    <p className={dashStyles.attendDetail}>{clock.detail}</p>
                  </div>
                  <Badge tone={attendanceClockTone(clock.value)}>{record?.status ?? clock.value}</Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className={dashStyles.bottomGrid}>
        <Card>
          <CardHeader>
            <DashboardSectionTitle
              title="Latest announcements"
              action={
                <Link href="/announcements" className={dashStyles.sectionLink}>
                  View all
                </Link>
              }
            />
          </CardHeader>
          <CardBody flush>
            {latestAnnouncements.length === 0 ? (
              <p className={dashStyles.empty}>No announcements yet.</p>
            ) : (
              latestAnnouncements.map((announcement) => (
                <Link key={announcement.announcement_id} href="/announcements" className={dashStyles.announceRow}>
                  <Badge tone={announcement.is_pinned ? "yellow" : "blue"}>{announcement.category}</Badge>
                  <p className={dashStyles.announceTitle}>{announcement.title}</p>
                  <p className={dashStyles.announceBody}>{announcement.body}</p>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <div className={dashStyles.bottomWide}>
          <ActivityFeed
            logs={recentActivity}
            users={data.users}
            title="Recent activity"
            emptyLabel="No recent activity yet."
            initialLimit={5}
          />
        </div>
      </div>
    </div>
  );
}

export function TaskListView({ data, scope }: { data: AppData; scope: "my" | "team" }) {
  const tasks = scope === "my" ? visibleTasksForUser(data.tasks, data.currentUser.user_id) : data.tasks;
  const canCreateTasks =
    hasPermission(data.currentUser.role_id, "tasks:own") ||
    hasPermission(data.currentUser.role_id, "tasks:team") ||
    hasPermission(data.currentUser.role_id, "tasks:manage");
  const canMoveFinished = canApproveTaskAsLeader(data.currentUser);
  const taskModalUsers = data.users.map((user) => ({ user_id: user.user_id, full_name: user.full_name, is_active: user.is_active }));
  const taskModalProjects = data.projects.map((project) => ({
    project_id: project.project_id,
    project_name: project.project_name,
    ticket_id_prefix: project.ticket_id_prefix || "",
  }));
  const createTaskAction = canCreateTasks ? (
    <CreateTaskModal currentUser={data.currentUser} users={taskModalUsers} projects={taskModalProjects} />
  ) : null;

  return (
    <Page>
      <TaskWorkspace
        tasks={tasks}
        users={data.users}
        projects={data.projects}
        checklists={data.checklists}
        currentUser={data.currentUser}
        scope={scope}
        canMoveFinished={canMoveFinished}
        action={createTaskAction}
      />
    </Page>
  );
}

function TaskCard({ task, users, compact = false }: { task: Task; users: User[]; compact?: boolean }) {
  return (
    <article className={styles.task}>
      <div className={styles.leaverequest}>
        <div className={styles.card}>
          <TicketId id={task.task_id} />
          <Link href={`/tasks/${task.task_id}`} className={styles.linkLink}>
            {task.title}
          </Link>
          {!compact ? <LinkifiedText text={task.description} className={styles.region} /> : null}
        </div>
        <StatusPill status={task.status} />
      </div>
      <div className={styles.panel}>
        <Badge tone={task.priority === "Urgent" ? "red" : task.priority === "High" ? "yellow" : "neutral"}>{task.priority}</Badge>
        {visibleTaskLabels(task.labels).slice(0, 3).map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </div>
      <div className={styles.block}><BoardStage status={task.status} dueDate={task.due_date} handedOffAt={task.handed_off_at} /></div>
      <div className={styles.surface}>
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
  const projectFiles = data.projectFiles
    .filter((file) => file.task_id === task.task_id)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const project = data.projects.find((candidate) => candidate.project_id === task.project_id);
  const taskLogs = data.activityLogs
    .filter((log) => log.entity_type === "Tasks" && log.entity_id === task.task_id)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  return (
    <div className={styles.filterBar}>
      <div className={styles.listBody}>
        <Card>
          <CardHeader>
            <div className={styles.card}>
              <TicketId id={task.task_id} />
              <h2 className={styles.breakwords}>{task.title}</h2>
              <LinkifiedText text={task.description} className={styles.linkLinkifiedtext} />
            </div>
          </CardHeader>
          <CardBody className={styles.emptyText}>
            <BoardStage status={task.status} dueDate={task.due_date} handedOffAt={task.handed_off_at} />
            <div className={styles.bodyDiv}>
              <InfoTile label="Project" value={project?.project_name ?? "No project"} />
              <InfoTile label="Date created" value={formatDate(task.created_at)} />
              <InfoTile label="Due date" value={formatDate(task.due_date)} />
              <InfoTile label="Priority" value={task.priority} />
              
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Checklist" />
          </CardHeader>
          <CardBody className={styles.bodyCardbody}>
            {checklist.map((item) => (
              <WorkflowChecklistItem key={item.checklist_id} item={item} task={task} currentUser={data.currentUser} />
            ))}
            <form action="/api/resources/Task_Checklists" method="post" className={styles.formForm}>
              <input type="hidden" name="task_id" value={task.task_id} />
              <input name="title" required className="input" placeholder="Add subtask" />
              <Button type="submit" variant="default" size="xl">
                <Plus className={styles.icon} />
                Add
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Completion report" />
          </CardHeader>
          <CardBody>
            <form action={`/api/resources/Tasks/${task.task_id}`} method="post" className={styles.bodyCardbody}>
              <textarea
                name="report"
                className={styles.reportfield}
                placeholder="Write completion report details here..."
                defaultValue={task.report || ""}
              />
              <Button type="submit" variant="default" size="lg" className={styles.control}>
                <Save className={styles.icon} />
                Save report
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Realtime comments" action={<Badge tone="blue">{comments.length}</Badge>} />
          </CardHeader>
          <CardBody className={styles.bodyPrimary}>
            {comments.map((comment) => (
              <div key={comment.comment_id} className={styles.item}>
                <Avatar name={userName(data.users, comment.user_id)} size="sm" />
                <div className={styles.bodySecondary}>
                  <div className={styles.badge}>
                    <p className={styles.textPrimary}>{userName(data.users, comment.user_id)}</p>
                    <p className={styles.textSecondary}>{formatDate(comment.created_at, { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                      <LinkifiedText text={comment.comment} className={styles.linkPrimary} />
                </div>
              </div>
            ))}
            <form action="/api/resources/Task_Comments" method="post" className={styles.bodyCardbody}>
              <input type="hidden" name="task_id" value={task.task_id} />
              <input type="hidden" name="user_id" value={data.currentUser.user_id} />
              <textarea name="comment" required className={styles.reportfield} placeholder="Add an update or mention a teammate" />
              <Button type="submit" variant="default" size="lg" className={styles.control}>
                <MessageCircle className={styles.icon} />
                Add comment
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <div className={styles.listBody}>
        <Card>
          <CardHeader>
            <SectionTitle title="Update task" />
          </CardHeader>
          <CardBody className={styles.bodyPrimary}>
            <TaskUpdatePanel
              task={task}
              checklist={checklist}
              currentUser={data.currentUser}
              users={data.users.map((user) => ({ user_id: user.user_id, full_name: user.full_name, is_active: user.is_active }))}
              projects={data.projects.map((project) => ({
                project_id: project.project_id,
                project_name: project.project_name,
                ticket_id_prefix: project.ticket_id_prefix,
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <SectionTitle
              title="Project File"
              action={
                <Link
                  href={`/project-files?project=${task.project_id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.linkSecondary)}
                >
                  <FolderOpen className={styles.icon} />
                  View all
                </Link>
              }
            />
          </CardHeader>
          <CardBody className={styles.bodyCardbody}>
            <ProjectFileForm taskId={task.task_id} />
            {projectFiles.length === 0 ? (
              <p className={styles.emptyText}>No files uploaded for this task yet.</p>
            ) : (
              <ul className={styles.list}>
                {projectFiles.map((file) => (
                  <li key={file.file_id}>
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.linkLink}
                    >
                      {file.file_mime === DRIVE_FOLDER_MIME ? (
                        <FolderOpen className={styles.surfaceFolderopen} />
                      ) : (
                        <Paperclip className={styles.surfacePaperclip} />
                      )}
                      <span className={styles.meta}>{file.title || file.file_name}</span>
                      <ExternalLink className={styles.surfacePaperclip} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <SectionTitle title="Assignees" />
          </CardHeader>
          <CardBody className={styles.bodyCardbody}>
            {task.assigned_to.map((id) => (
              <div key={id} className={styles.itemDiv}>
                <Avatar name={userName(data.users, id)} size="sm" />
                <div>
                  <p className={styles.textPrimary}>{userName(data.users, id)}</p>
                  <p className={styles.textSecondary}>Assigned by {userName(data.users, task.assigned_by)}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
        <ActivityFeed logs={taskLogs} users={data.users} title="Task activity" emptyLabel="No activity yet." initialLimit={5} />
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infotile}>
      <p className={styles.textInfotile}>{label}</p>
      <p className={styles.textTertiary}>{value}</p>
    </div>
  );
}

export function ProjectFilesView({ data, projectId }: { data: AppData; projectId?: string }) {
  const project = projectId ? data.projects.find((candidate) => candidate.project_id === projectId) : undefined;
  const files = data.projectFiles
    .filter((file) => !projectId || file.project_id === projectId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  return (
    <Page>
      <div className={styles.projectfiles}>
        <div className={styles.card}>
          <h2 className={styles.heading}>
            {project ? `${project.project_name} â€” Project Files` : "All Project Files"}
          </h2>
          <p className={styles.text}>{files.length} file{files.length === 1 ? "" : "s"}</p>
        </div>
        <Link href="/projects" className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.control)}>
          <FolderOpen className={styles.icon} />
          Projects
        </Link>
      </div>

      {files.length === 0 ? (
        <div className={styles.emptystateDiv}>
          No project files uploaded yet. Upload one from a task&apos;s â€œProject Fileâ€ panel.
        </div>
      ) : (
        <div className={styles.bodyCardbody}>
          {files.map((file) => (
            <a
              key={file.file_id}
              href={file.file_url}
              target="_blank"
              rel="noreferrer"
              className={styles.linkLinkifiedtext}
            >
              {file.file_mime === DRIVE_FOLDER_MIME ? (
                <FolderOpen className={styles.surfacePrimary} />
              ) : (
                <Paperclip className={styles.surfaceSecondary} />
              )}
              <div className={styles.content}>
                <TicketId id={file.task_id} />
                <p className={styles.textAlt}>{file.title || file.file_name}</p>
                <p className={styles.textAside}>Owner: {userName(data.users, file.owner_user_id)}</p>
              </div>
              <ExternalLink className={styles.surfacePaperclip} />
            </a>
          ))}
        </div>
      )}
    </Page>
  );
}

export function ProjectsView(data: AppData) {
  const canManageProjects = hasPermission(data.currentUser.role_id, "projects:manage");
  const activeProjectUsers = data.users.filter((user) => user.is_active);
  const projectModalUsers = data.users.map((user) => ({ user_id: user.user_id, full_name: user.full_name, is_active: user.is_active }));
  const createProjectAction = canManageProjects ? <CreateProjectModal currentUser={data.currentUser} users={projectModalUsers} /> : null;

  return (
    <Page>
      <DataToolbar tabs={["All", "Active", "Review", "Completed"]} action={createProjectAction} />

      <div className={styles.dialogPanel}>
        {data.projects.map((project) => (
          <Card key={project.project_id}>
            <CardHeader>
              <div className={styles.linkLink}>
                <div className={styles.card}>
                  <TicketId id={project.ticket_id_prefix || project.project_id} />
                  <p className={styles.itemMeta}>{project.project_name}</p>
                  <p className={styles.text}>Owner: {userName(data.users, project.owner_user_id)}</p>
                </div>
                <StatusPill status={project.status} />
              </div>
            </CardHeader>
            <CardBody className={styles.bodyPrimary}>
              <p className={styles.textInner}>{project.description}</p>
              <Progress value={clampProgress(project.progress)} label={`Deadline ${formatShortDate(project.deadline)}`} />
              <div className={styles.bodyDiv}>
                <div className={styles.bodyCardbody}>
                  {project.members.slice(0, 4).map((id) => (
                    <Avatar key={id} name={userName(data.users, id)} size="sm" />
                  ))}
                </div>
                <Badge tone={project.priority === "Urgent" ? "red" : project.priority === "High" ? "yellow" : "neutral"}>{project.priority}</Badge>
              </div>
              <Link
                href={`/project-files?project=${project.project_id}`}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.itemDiv)}
              >
                <FolderOpen className={styles.icon} />
                Project Files
              </Link>
              {canManageProjects ? (
                <details className={styles.surfaceDetails}>
                  <summary className={styles.surfaceSummary}>Edit project</summary>
                  <form action={`/api/resources/Projects/${project.project_id}`} method="post" className={styles.formForm}>
                    <Field label="Project name"><input name="project_name" required className="input" defaultValue={project.project_name} /></Field>
                    <Field label="Ticket ID code"><input name="ticket_id_prefix" required className="input" defaultValue={project.ticket_id_prefix} maxLength={5} /></Field>
                    <Field label="Owner">
                      <FormSelect
                        name="owner_user_id"
                        defaultValue={project.owner_user_id}
                        options={activeProjectUsers.map((user) => ({ value: user.user_id, label: user.full_name }))}
                      />
                    </Field>
                    <Field label="Status">
                      <FormSelect
                        name="status"
                        defaultValue={project.status}
                        options={projectStatuses.map((status) => ({ value: status, label: status }))}
                      />
                    </Field>
                    <div className={styles.layout}>
                      <Field label="Priority">
                        <FormSelect
                          name="priority"
                          defaultValue={project.priority}
                          options={["Low", "Medium", "High", "Urgent"].map((priority) => ({ value: priority, label: priority }))}
                        />
                      </Field>
                      <Field label="Progress"><input name="progress" type="number" min="0" max="100" className="input" defaultValue={project.progress} /></Field>
                    </div>
                    <Field label="Deadline"><DatePickerField name="deadline" required defaultValue={project.deadline} variant="form" /></Field>
                    <Field label="Members">
                      <div className={styles.surfaceDeadline}>
                        {activeProjectUsers.map((user) => (
                          <label key={user.user_id} className={styles.label}>
                            <input name="members" type="checkbox" value={user.user_id} defaultChecked={project.members.includes(user.user_id)} className={styles.membersinput} />
                            <span className={styles.captionMembers}>{user.full_name}</span>
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Links"><input name="links" className="input" defaultValue={project.links.join(", ")} /></Field>
                    <Field label="Description"><textarea name="description" required className={styles.input} defaultValue={project.description} /></Field>
                    <Field label="Notes"><textarea name="notes" className={styles.input} defaultValue={project.notes} /></Field>
                    <div className={styles.statuscatalog}>
                      <Button type="submit" variant="default" size="xl">Save project</Button>
                    </div>
                  </form>
                  <form action={`/api/resources/Projects/${project.project_id}`} method="post" className={styles.formPrimary}>
                    <input type="hidden" name="_method" value="delete" />
                    <Button type="submit" variant="destructiveOutline" size="xl">
                      <Trash2 className={styles.icon} />
                      Remove project
                    </Button>
                  </form>
                </details>
              ) : null}
            </CardBody>
          </Card>
        ))}
      </div>
    </Page>
  );
}

type CalendarActivity = {
  id: string;
  title: string;
  description: string;
  type: string;
  date: string;
  href: string;
};

function dateKey(value: string) {
  return String(value || "").slice(0, 10);
}

function currentMonthKey() {
  return jakartaToday().slice(0, 7);
}

function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function monthCells(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingEmptyCells = firstDay.getUTCDay();
  const cells: Array<string | null> = Array.from({ length: leadingEmptyCells }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${monthKey}-${String(day).padStart(2, "0")}`);
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function birthdayInMonth(user: User, monthKey: string) {
  const monthDay = dateKey(user.birthday).slice(5, 10);
  if (!monthDay) return "";
  return `${monthKey}-${monthDay.slice(3, 5)}`;
}

function buildCalendarActivities(data: AppData, monthKey: string): CalendarActivity[] {
  const activities: CalendarActivity[] = [];
  const inMonth = (date: string) => dateKey(date).startsWith(monthKey);

  data.calendarEvents.filter((event) => inMonth(event.start_date)).forEach((event) => {
    activities.push({
      id: event.event_id,
      title: event.title,
      description: event.description,
      type: event.type,
      date: dateKey(event.start_date),
      href: "/calendar",
    });
  });

  data.tasks.filter((task) => inMonth(task.due_date)).forEach((task) => {
    activities.push({
      id: `task-${task.task_id}`,
      title: task.title,
      description: `${task.status} Â· ${task.priority}`,
      type: "Deadline",
      date: task.due_date,
      href: `/tasks/${task.task_id}`,
    });
  });

  data.projects.filter((project) => inMonth(project.deadline)).forEach((project) => {
    activities.push({
      id: `project-${project.project_id}`,
      title: project.project_name,
      description: `${project.status} Â· ${project.priority}`,
      type: "Project Milestone",
      date: project.deadline,
      href: "/projects",
    });
  });

  announcementsForUser(data.announcements, data.currentUser).filter((announcement) => inMonth(announcement.scheduled_at)).forEach((announcement) => {
    activities.push({
      id: `announcement-${announcement.announcement_id}`,
      title: announcement.title,
      description: announcement.category,
      type: "Announcement",
      date: dateKey(announcement.scheduled_at),
      href: "/announcements",
    });
  });

  data.leaveRequests.filter((request) => inMonth(request.start_date)).forEach((request) => {
    activities.push({
      id: `leave-${request.request_id}`,
      title: `${userName(data.users, request.user_id)} ${request.request_type}`,
      description: `${request.status} Â· ${formatShortDate(request.start_date)} to ${formatShortDate(request.end_date)}`,
      type: request.request_type,
      date: request.start_date,
      href: "/attendance/request",
    });
  });

  activeUsers(data.users).forEach((user) => {
    const date = birthdayInMonth(user, monthKey);
    if (!date || !date.startsWith(monthKey)) return;
    activities.push({
      id: `birthday-${user.user_id}`,
      title: `${user.full_name}'s birthday`,
      description: departmentName(data.departments, user.department_id),
      type: "Birthday",
      date,
      href: `/employees/${user.user_id}`,
    });
  });

  return activities.sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title));
}

export function CalendarView(data: AppData) {
  const monthKey = currentMonthKey();
  const activities = buildCalendarActivities(data, monthKey);
  const grouped = groupBy(activities, (event) => event.date);
  const typeCounts = Object.entries(groupBy(activities, (event) => event.type)).sort((left, right) => right[1].length - left[1].length);
  const today = jakartaToday();

  return (
    <Page>
      <DataToolbar tabs={["Month", "Week", "Day"]} />
      <div className={styles.calendar}>
        <Card>
          <CardHeader>
            <SectionTitle title={monthTitle(monthKey)} action={<Badge tone="blue">{activities.length} activities</Badge>} />
          </CardHeader>
          <CardBody className={styles.bodyCardbody}>
            {typeCounts.map(([type, events]) => (
              <div key={type} className={styles.bodyPrimary}>
                <div className={styles.card}>
                  <Badge tone={statusTone(type)}>{type}</Badge>
                  <p className={styles.itemDescription}>{events.length} item{events.length === 1 ? "" : "s"}</p>
                </div>
                <span className={styles.badge}>{events.length}</span>
              </div>
            ))}
            {typeCounts.length === 0 ? <EmptyState label="No activities this month." /> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Monthly activity" action={<Badge>Current month</Badge>} />
          </CardHeader>
          <CardBody className={styles.bodyPrimary}>
            <div className={styles.bodyDiv}>
              <div className={styles.bodyCardbody}>
                <div className={styles.bodySecondary}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className={styles.section}>
                  {monthCells(monthKey).map((date, index) => {
                    const events = date ? grouped[date] ?? [] : [];

                    return (
                      <div key={date ?? `empty-${index}`} className={cn(styles.emptystatePrimary, date === today ? styles.emptystateSecondary : styles.emptystateTertiary, !date && styles.emptystateAlt)}>
                        {date ? (
                          <>
                            <p className={styles.header}>{Number(date.slice(8, 10))}</p>
                            <div className={styles.emptystateAside}>
                              {events.slice(0, 3).map((event) => (
                                <Link key={event.id} href={event.href} className={styles.linkLink}>
                                  <span className={styles.captionSpan}>{event.title}</span>
                                  <span className={styles.captionPrimary}>{event.type}</span>
                                </Link>
                              ))}
                              {events.length > 3 ? <p className={styles.textOuter}>+{events.length - 3} more</p> : null}
                            </div>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className={styles.surfaceDiv}>
              {activities.slice(0, 8).map((event) => (
                <Link key={event.id} href={event.href} className={styles.linkLinkifiedtext}>
                  <Badge tone={statusTone(event.type)}>{event.type}</Badge>
                  <p className={styles.textLead}>{event.title}</p>
                  <p className={styles.text}>{formatDate(event.date)}</p>
                  <p className={styles.textTrail}>{event.description}</p>
                </Link>
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
      <div className={styles.attendance}>
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
                <Link href="/attendance/request" className={styles.linkTertiary}>
                  Open queue
                </Link>
              }
            />
          </CardHeader>
          <CardBody className={styles.bodyCardbody}>
            {pendingRequests.map((request) => (
              <LeaveRequestCard key={request.request_id} request={request} users={data.users} canApprove={data.canApproveLeave} />
            ))}
          </CardBody>
        </Card>
      ) : null}

      <div className={styles.bodyTertiary}>
        <AttendanceTerminal />

        <Card>
          <CardHeader>
            <SectionTitle title="Leave request" />
          </CardHeader>
          <CardBody>
            <Link href="/attendance/request" className={styles.surfaceSecondary}>
              <Plus className={styles.icon} />
              Request leave
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle title="Attendance history" action={<Button type="button" variant="link" size="sm"><Download className={styles.icon} /> Export</Button>} />
          </CardHeader>
          <CardBody className={styles.roles}>
            <DataTable
              headers={["Employee", "Date", "Clock in", "Clock out", "Active time", "Locations", "Status", "Approval", "EOD summary"]}
              rows={data.attendance.map((item) => [
                userName(data.users, item.user_id),
                formatDate(item.date),
                item.clock_in || "-",
                item.clock_out || "-",
                formatActiveMinutes(item.active_minutes),
                item.location_count || "-",
                <StatusPill key="status" status={item.status} />,
                item.approval_status,
                item.note || "-",
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
    <div className={styles.gamificationsettings}>
      <Card>
        <CardHeader>
          <SectionTitle title="Submit request" />
        </CardHeader>
        <CardBody>
          <form action="/api/resources/Leave_Requests" method="post" encType="multipart/form-data" className={styles.bodyPrimary}>
            <input type="hidden" name="user_id" value={data.currentUser.user_id} />
            <Field label="Type">
              <FormSelect
                name="request_type"
                defaultValue="Izin"
                options={["Izin", "Sick", "Cuti", "WFH", "Half Day"].map((type) => ({ value: type, label: type }))}
              />
            </Field>
            <div className={styles.region}>
              <Field label="Start"><DatePickerField name="start_date" required variant="form" /></Field>
              <Field label="End"><DatePickerField name="end_date" required variant="form" /></Field>
            </div>
            <Field label="Reason"><textarea name="reason" required className={styles.startDateinput} /></Field>
            <Field label="Attachment">
              <input name="attachment_url" type="url" className="input" placeholder="https://" />
              <input name="attachment_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="input" />
            </Field>
            <Button type="submit" variant="default" size="xl" className={styles.button}>Submit request</Button>
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
        <CardBody className={styles.bodyCardbody}>
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
    <div className={styles.filterBar}>
      <Card>
        <CardHeader>
          <SectionTitle title="Company feed" action={<Badge tone="blue">{visibleAnnouncements.length} posts</Badge>} />
        </CardHeader>
        <CardBody className={styles.bodyPrimary}>
          {visibleAnnouncements.map((announcement) => (
            <article key={announcement.announcement_id} className={styles.cardArticle}>
              <div className={styles.body}>
                <Badge tone={announcement.is_pinned ? "yellow" : "blue"}>{announcement.category}</Badge>
                {announcement.is_pinned ? <Badge tone="neutral">Pinned</Badge> : null}
                <span className={styles.header}>{formatDate(announcement.scheduled_at)}</span>
              </div>
              <h2 className={styles.headingH}>{announcement.title}</h2>
              <p className={styles.linkPrimary}>{announcement.body}</p>
              <p className={styles.textMain}>By {userName(data.users, announcement.created_by)}</p>
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
            <AnnouncementCreateForm createdBy={data.currentUser.user_id} />
          ) : (
            <div className={styles.bodyCardbody}>
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
      <div className={styles.bodyEmployeesview}>
        <MetricCard label="Active employees" value={String(activeEmployeeCount)} detail={`${employees.length} in directory`} icon={Users} />
        <MetricCard label="Departments" value={String(data.departments.length)} detail="Leader assigned teams" icon={ShieldCheck} tone="blue" />
        <MetricCard label="Birthdays" value={String(birthdayCount)} detail="Upcoming in the next 30 days" icon={Cake} tone="yellow" />
      </div>
      <Card>
        <CardHeader>
          <SectionTitle title="Employee directory" action={<Link href="/invite" className={cn(buttonVariants({ variant: "default", size: "lg" }), styles.control)}><Plus className={styles.icon} /> Invite</Link>} />
        </CardHeader>
        <CardBody className={styles.roles}>
          <DataTable
            headers={["Name", "Department", "Position", "Status", "Role", "Performance"]}
            rows={employees.map((user) => [
              <Link key="name" href={`/employees/${user.user_id}`} className={styles.linkAlt}><Avatar name={user.full_name} size="sm" /> {user.full_name}</Link>,
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
    <div className={styles.emptystateInner}>
      <Card>
        <CardBody className={styles.emptyText}>
          <div className={styles.bodyAlt}>
            <Avatar name={employee.full_name} image={employee.profile_photo} size="lg" />
            <h2 className={styles.headingPrimary}>{employee.full_name}</h2>
            <p className={styles.emptyText}>{employee.position}</p>
          </div>
          <div className={styles.emptystateOuter}>
            <InfoTile label="Department" value={departmentName(data.departments, employee.department_id)} />
            <InfoTile label="Role" value={data.roles.find((role) => role.role_id === employee.role_id)?.role_name ?? employee.role_id} />
            <InfoTile label="Account" value={employee.is_active ? "Active" : "Inactive"} />
            <InfoTile label="Birthday" value={formatDate(employee.birthday)} />
            <InfoTile label="Join date" value={formatDate(employee.join_date)} />
          </div>
        </CardBody>
      </Card>

      <div className={styles.listBody}>
        <div className={styles.bodyEmployeesview}>
          <MetricCard label="Performance score" value={String(score)} detail="All-time points" icon={Trophy} tone="yellow" />
          <MetricCard label="Assigned tasks" value={String(employeeTasks.length)} detail={`${employeeDoneTasks.length} completed`} icon={CheckSquare} />
          <MetricCard label="Attendance this week" value={`${weekAttendanceRate}%`} detail={`${employeeAttendance.length} records on file`} icon={CalendarCheck} tone="green" />
        </div>
        <Card>
          <CardHeader>
            <SectionTitle title="Task history" />
          </CardHeader>
          <CardBody className={styles.bodyCardbody}>
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
            <CardBody className={styles.bodyPrimary}>
              <EmployeeAdminControls
                employee={{
                  user_id: employee.user_id,
                  full_name: employee.full_name,
                  email: employee.email,
                  position: employee.position,
                  department_id: employee.department_id,
                  role_id: employee.role_id,
                  employment_status: employee.employment_status,
                  birthday: employee.birthday,
                  join_date: employee.join_date,
                  is_active: employee.is_active,
                  profile_photo: employee.profile_photo,
                  bio: employee.bio,
                }}
                departments={data.departments.map((department) => ({
                  department_id: department.department_id,
                  department_name: department.department_name,
                }))}
                roles={data.roles.map((role) => ({ role_id: role.role_id, role_name: role.role_name }))}
                statuses={employeeStatusOptions}
                canRemove={employee.user_id !== data.currentUser.user_id}
              />
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
  const recentPoints = [...data.points].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 8);
  const taskDonePointCount = data.points.filter((point) => point.source_type === "task_done").length;
  const punctualPointCount = data.points.filter((point) => point.source_type === "punctual_attendance").length;
  const canManageScores = canManageLeaderboardScore(data.currentUser);
  const editableUsers = data.users.filter((user) => user.is_active);

  return (
    <Page>
      <DataToolbar tabs={["Weekly", "Monthly", "All-time", "Department"]} />
      <div className={styles.attendance}>
        <MetricCard label="Point events" value={String(data.points.length)} detail="All recorded scoring actions" icon={Sparkles} tone="blue" />
        <MetricCard label="Task done" value={String(taskDonePointCount)} detail="Completion awards issued" icon={CheckCircle2} tone="green" />
        <MetricCard label="Punctual" value={String(punctualPointCount)} detail="On-time attendance awards" icon={Clock3} tone="yellow" />
      </div>

      <Card>
        <CardBody>
          <div className={styles.bodyAside}>
            {podium.map((row) => {
              const rank = row === rows[0] ? 1 : row === rows[1] ? 2 : 3;
              return (
                <div key={row.user.user_id} className={cn(styles.bodyInner, rank === 1 && "md:order-2", rank === 2 && "md:order-1", rank === 3 && "md:order-3")}>
                  <div className={styles.glyph}>
                    <div className={cn(styles.iconDiv, rank === 1 ? styles.iconPrimary : styles.iconSecondary)}>
                      <Crown className={styles.icon} />
                      Rank {rank}
                    </div>
                    <Avatar name={row.user.full_name} size="lg" />
                    <p className={styles.textLead}>{row.user.full_name}</p>
                    <p className={styles.emptyText}>{row.badges[0]?.badge_name ?? "Team Player"}</p>
                    <p className={styles.emptytextP}>{row.points}</p>
                  </div>
                  <div className={cn(styles.emptystateOuter, rank === 1 ? styles.iconDiv : rank === 2 ? styles.iconPrimary : styles.iconSecondary)} />
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {canManageScores ? (
        <Card>
          <CardHeader>
            <SectionTitle title="Manage scores" action={<Badge tone="yellow">Admin</Badge>} />
          </CardHeader>
          <CardBody className={styles.dialogPanel}>
            <form action="/api/leaderboard/score" method="post" className={styles.formSecondary}>
              <input type="hidden" name="mode" value="adjust" />
              <Field label="User">
                <FormSelect
                  name="user_id"
                  required
                  defaultValue={editableUsers[0]?.user_id ?? ""}
                  options={editableUsers.map((user) => ({ value: user.user_id, label: user.full_name }))}
                />
              </Field>
              <Field label="Adjust points">
                <input name="points" required type="number" className="input" placeholder="25 or -10" />
              </Field>
              <Field label="Reason">
                <input name="reason" required className="input" placeholder="Manual correction or bonus" />
              </Field>
              <Button type="submit" variant="default" size="xl">Apply adjustment</Button>
            </form>

            <form action="/api/leaderboard/score" method="post" className={styles.formSecondary}>
              <input type="hidden" name="mode" value="set_total" />
              <Field label="User">
                <FormSelect
                  name="user_id"
                  required
                  defaultValue={editableUsers[0]?.user_id ?? ""}
                  options={editableUsers.map((user) => ({
                    value: user.user_id,
                    label: `${user.full_name} - current ${scoreForUser(data.points, user.user_id)}`,
                  }))}
                />
              </Field>
              <Field label="Set total score">
                <input name="target_score" required type="number" min="0" className="input" placeholder="100" />
              </Field>
              <Field label="Reason">
                <input name="reason" required className="input" placeholder="Score correction" />
              </Field>
              <Button type="submit" variant="default" size="xl">Set score</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <SectionTitle title="Full ranking" />
        </CardHeader>
        <CardBody className={styles.roles}>
          <DataTable
            headers={["Rank", "Name", "Department", "Points", "Badge"]}
            rows={rows.map((row, index) => [
              index + 1,
              <span key="name" className={styles.linkAlt}><Avatar name={row.user.full_name} size="sm" /> {row.user.full_name}</span>,
              departmentName(data.departments, row.user.department_id),
              row.points,
              row.badges[0]?.badge_name ?? "Team Player",
            ])}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle title="Recent point activity" />
        </CardHeader>
        <CardBody className={styles.roles}>
          <DataTable
            headers={["User", "Source", "Points", "Reason", "Date"]}
            rows={recentPoints.map((point) => [
              userName(data.users, point.user_id),
              point.source_type.replaceAll("_", " "),
              point.points,
              point.reason,
              formatDate(point.created_at, { hour: "2-digit", minute: "2-digit" }),
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
    <Card className={styles.card}>
      <CardHeader>
        <SectionTitle
          title="Notification history"
          action={
            <div className={styles.body}>
              {unreadCount > 0 ? <Badge tone="yellow">{unreadCount} unread</Badge> : <Badge tone="green">All read</Badge>}
              <MarkAllNotificationsReadButton
                disabled={unreadCount === 0}
                className={styles.buttonMarkallnotificationsreadbutton}
              />
            </div>
          }
        />
      </CardHeader>
      <CardBody className={styles.bodyCardbody}>
        {myNotifications.length === 0 ? (
          <EmptyState label="No notifications yet." />
        ) : (
          myNotifications.map((notification) => (
            <NotificationLink
              key={notification.notification_id}
              notification={notification}
              href={notification.related_link || "/dashboard"}
              className={cn(styles.linkTertiary, notification.is_read ? styles.linkAlt : styles.linkNotificationlink)}
            >
              <div className={styles.iconTertiary}>
                <Bell className={styles.icon} />
                {!notification.is_read ? <span className={styles.captionSecondary} aria-hidden="true" /> : null}
              </div>
              <div className={styles.content}>
                <div className={styles.body}>
                  <p className={styles.itemMeta}>{notification.title}</p>
                  {!notification.is_read ? <Badge tone="blue">Unread</Badge> : null}
                </div>
                <p className={styles.text}>{notification.description}</p>
                <p className={styles.textSub}>{formatDate(notification.created_at, { hour: "2-digit", minute: "2-digit" })}</p>
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
      <div className={styles.filterbarPrimary}>
        <MetricCard label="Total users" value={String(directoryUsers(data.users).length)} detail="Registered accounts" icon={Users} />
        <MetricCard label="Active employees" value={String(activeEmployeeCount)} detail="Currently active" icon={Activity} tone="green" />
        <MetricCard label="Completion rate" value={percent(completionRate)} detail={data.tasks.length === 0 ? "No tasks yet" : `${completedTasks(data.tasks).length} of ${data.tasks.length} tasks done`} icon={Gauge} tone="blue" />
        <MetricCard label="Late tasks" value={String(lateTasks)} detail={pendingLeave > 0 ? `${pendingLeave} leave requests pending` : "Needs attention"} icon={AlarmClock} tone="yellow" />
      </div>
      <Card>
        <CardHeader>
          <SectionTitle title="Account requests" action={<Badge tone={pendingRequests.length > 0 ? "yellow" : "green"}>{pendingRequests.length} pending</Badge>} />
        </CardHeader>
        <CardBody className={styles.bodyCardbody}>
          {pendingRequests.length === 0 ? (
            <EmptyState label="No pending account requests." />
          ) : (
            pendingRequests.map((user) => (
              <div key={user.user_id} className={styles.linkPrimary}>
                <div className={styles.card}>
                  <div className={styles.body}>
                    <p className={styles.itemMeta}>{user.full_name}</p>
                    <Badge tone={user.signup_status === "approved" ? "blue" : "yellow"}>{user.signup_status}</Badge>
                    <Badge>{user.signup_provider || "password"}</Badge>
                  </div>
                  <p className={styles.text}>{user.email}</p>
                  {user.bio ? <p className={styles.textFoot}>{user.bio}</p> : null}
                  <p className={styles.textSub}>
                    Requested {user.requested_at ? formatDate(user.requested_at, { hour: "2-digit", minute: "2-digit" }) : "recently"}
                  </p>
                </div>
                <div className={styles.surfaceTertiary}>
                  <form action={`/api/admin/account-requests/${user.user_id}`} method="post">
                    <input type="hidden" name="intent" value="approve" />
                    <Button type="submit" variant="default" size="xl" className={styles.button}>
                      <CheckCircle2 className={styles.icon} />
                      Allow
                    </Button>
                  </form>
                  <form action={`/api/admin/account-requests/${user.user_id}`} method="post" className={styles.form}>
                    <input type="hidden" name="intent" value="reject" />
                    <input name="rejection_reason" className="input" placeholder="Reason" />
                    <Button type="submit" variant="destructiveOutline" size="xl" className={styles.button}>
                      <XCircle className={styles.icon} />
                      Disallow
                    </Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
      <div className={styles.filterBar}>
        <ActivityFeed logs={data.activityLogs} users={data.users} />
        <Card>
          <CardHeader>
            <SectionTitle title="System settings" />
          </CardHeader>
          <CardBody className={styles.bodyCardbody}>
            <InfoTile label="Data source" value={dataSourceLabel()} />
            <InfoTile label="PWA" value="Manifest, service worker, offline page" />
            <InfoTile label="Security" value="HTTP-only session cookie and server RBAC" />
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}

export function SettingsView(data: AppData) {
  return (
    <div className={styles.bodySettingsview}>
      <div className={styles.bodyTertiary}>
        <Card>
          <CardHeader>
            <SectionTitle
              title="Task workflows"
              action={
                <Link href="/workflows" className={cn(buttonVariants({ variant: "default", size: "lg" }), styles.control)}>
                  <GitBranch className={styles.icon} />
                  Manage workflows
                </Link>
              }
            />
          </CardHeader>
          <CardBody className={styles.list}>
            <p className={styles.emptyText}>
              Atur papan workflow untuk mengelompokkan task. Saat membuat workflow, project opsional â€” task project
              yang terhubung ikut tampil di board tersebut.
            </p>
            <Link href="/workflows" className={styles.linkAside}>
              Buka menu Workflow
              <ExternalLink className={styles.linkExternallink} />
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <SectionTitle title="CMS settings" />
          </CardHeader>
          <CardBody className={styles.roles}>
            <DataTable
              headers={["Key", "Value", "Type", "Updated"]}
              rows={data.settings.map((setting) => [setting.setting_key, setting.setting_value, setting.setting_type, formatDate(setting.updated_at)])}
            />
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <SectionTitle title="Database connection" />
        </CardHeader>
        <CardBody className={styles.bodyCardbody}>
          <InfoTile label="Source" value={dataSourceLabel()} />
          <InfoTile label="Supabase URL" value={supabaseConfigLabel()} />
          <InfoTile label="Supabase secret" value={supabaseSecretLabel()} />
          {process.env.ATM_DATA_MODE !== "supabase" ? (
            <form action="/api/admin/migrate-supabase" method="post">
              <Button type="submit" variant="default" size="xl" className={styles.button}>
                Migrate current data to Supabase
              </Button>
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
    <div className={styles.bodyDepartmentsmanagerview}>
      <Card>
        <CardHeader>
          <SectionTitle title="Add department" />
        </CardHeader>
        <CardBody>
          <form action="/api/resources/Departments" method="post" className={styles.bodyPrimary}>
            <Field label="Department name">
              <input name="department_name" required className="input" placeholder="Creative Team" />
            </Field>
            <Field label="Leader">
              <FormSelect
                name="leader_user_id"
                defaultValue=""
                placeholder="No leader assigned"
                options={[
                  { value: "", label: "No leader assigned" },
                  ...data.users
                    .filter((user) => user.is_active)
                    .map((user) => ({ value: user.user_id, label: user.full_name })),
                ]}
              />
            </Field>
            <Button type="submit" variant="default" size="xl" className={styles.button}>
              <Plus className={styles.icon} />
              Add department
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle title="Departments" />
        </CardHeader>
        <CardBody className={styles.bodyCardbody}>
          {data.departments.length === 0 ? (
            <EmptyState label="No departments yet." />
          ) : (
            data.departments.map((department) => {
              const memberCount = usersByDepartment[department.department_id]?.length ?? 0;

              return (
                <div key={department.department_id} className={styles.infotile}>
                  <div className={styles.emptystateLead}>
                    <div className={styles.emptystateTrail}>
                      <div className={styles.emptystateLead}>
                        <Building2 className={styles.emptystateMain} />
                      </div>
                      <div className={styles.card}>
                        <p className={styles.ellipsis}>{department.department_name}</p>
                        <p className={styles.header}>
                          {memberCount} member{memberCount === 1 ? "" : "s"} Â· ID <code className={styles.breakall}>{department.department_id}</code>
                        </p>
                      </div>
                    </div>
                    <Badge tone={memberCount > 0 ? "blue" : "neutral"}>{userName(data.users, department.leader_user_id)}</Badge>
                  </div>

                  <div className={styles.surfaceAlt}>
                    <form action={`/api/resources/Departments/${department.department_id}`} method="post" className="contents">
                      <Field label="Name">
                        <input name="department_name" required className="input" defaultValue={department.department_name} />
                      </Field>
                      <Field label="Leader">
                        <FormSelect
                          name="leader_user_id"
                          defaultValue={department.leader_user_id}
                          placeholder="No leader assigned"
                          options={[
                            { value: "", label: "No leader assigned" },
                            ...data.users
                              .filter((user) => user.is_active)
                              .map((user) => ({ value: user.user_id, label: user.full_name })),
                          ]}
                        />
                      </Field>
                      <div className={styles.filterbarSecondary}>
                        <Button type="submit" variant="default" size="xl">
                          Save
                        </Button>
                      </div>
                    </form>

                    <form action={`/api/resources/Departments/${department.department_id}`} method="post" className="lg:col-start-3">
                      <input type="hidden" name="_method" value="delete" />
                      <Button type="submit" variant="destructiveOutline" size="xl" className={styles.buttonAlt}>
                        <Trash2 className={styles.icon} />
                        Remove
                      </Button>
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
      <CardBody className={styles.roles}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.headercell}>Permission</th>
              {data.roles.map((role) => (
                <th key={role.role_id} className={styles.bodyTertiary}>{role.role_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission} className={styles.bodyEmployeesview}>
                <td className={styles.iconPrimary}>{permission}</td>
                {data.roles.map((role) => (
                  <td key={role.role_id} className={styles.linkSecondary}>
                    {role.permissions_json.includes(permission) ? <CheckCircle2 className={styles.iconAlt} /> : <span className={styles.captionTertiary}>-</span>}
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
    <div className={styles.bodyAttendancesettingsview}>
      <Card>
        <CardHeader><SectionTitle title="Work rules" /></CardHeader>
        <CardBody className={styles.bodyCardbody}>
          <Field label="Official clock-in"><input className="input" defaultValue={data.settings.find((setting) => setting.setting_key === "official_clock_in")?.setting_value} /></Field>
          <Field label="Official clock-out"><input className="input" defaultValue={data.settings.find((setting) => setting.setting_key === "official_clock_out")?.setting_value} /></Field>
          <Field label="Grace period"><input className="input" defaultValue={data.settings.find((setting) => setting.setting_key === "grace_period_minutes")?.setting_value} /></Field>
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><SectionTitle title="Approval statuses" /></CardHeader>
        <CardBody className={styles.bodyOuter}>
          {attendanceStatuses.map((status) => <StatusPill key={status} status={status} />)}
        </CardBody>
      </Card>
    </div>
  );
}

export function GamificationSettingsView(data: AppData) {
  return (
    <div className={styles.gamificationsettings}>
      <Card>
        <CardHeader><SectionTitle title="Point rules" /></CardHeader>
        <CardBody className={styles.bodyCardbody}>
          {["Completing tasks", "Before deadline", "Helpful comments", "Good attendance", "Late task deduction", "Rejected task deduction", "Overdue task deduction"].map((rule, index) => (
            <div key={rule} className={styles.surfacePaperclip}>
              <span className={styles.textPrimary}>{rule}</span>
              <Badge tone={index > 3 ? "red" : "green"}>{index > 3 ? "-" : "+"}{[50, 25, 10, 15, 20, 30, 20][index]}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><SectionTitle title="Badges" /></CardHeader>
        <CardBody className={styles.layout}>
          {data.badges.map((badge) => (
            <div key={badge.badge_id} className={styles.infotile}>
              <div className={styles.bodyLead}>
                <Sparkles className={styles.iconSecondary} />
                <p className={styles.itemMeta}>{badge.badge_name}</p>
              </div>
              <p className={styles.textFoot}>{badge.description}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

export function InviteView(data: AppData) {
  return (
    <div className={styles.bodyInviteview}>
      <Card>
        <CardHeader><SectionTitle title="Invite employee" /></CardHeader>
        <CardBody>
          <form action="/api/resources/Users" method="post" encType="multipart/form-data" className={styles.bodyPrimary}>
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
            <Field label="Department">
              <FormSelect
                name="department_id"
                defaultValue={data.departments[0]?.department_id ?? ""}
                options={data.departments.map((department) => ({
                  value: department.department_id,
                  label: department.department_name,
                }))}
              />
            </Field>
            <div className={styles.region}>
              <Field label="Role">
                <FormSelect
                  name="role_id"
                  defaultValue={data.roles[0]?.role_id ?? ""}
                  options={data.roles.map((role) => ({ value: role.role_id, label: role.role_name }))}
                />
              </Field>
              <Field label="Status">
                <FormSelect
                  name="employment_status"
                  defaultValue={employeeStatusOptions[0]}
                  options={employeeStatusOptions.map((status) => ({ value: status, label: status }))}
                />
              </Field>
            </div>
            <div className={styles.region}>
              <Field label="Birthday"><DatePickerField name="birthday" variant="form" /></Field>
              <Field label="Join date"><DatePickerField name="join_date" variant="form" /></Field>
            </div>
            <Button type="submit" variant="default" size="xl" className={styles.button}>Create invite</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><SectionTitle title="Role defaults" /></CardHeader>
        <CardBody className={styles.bodyCardbody}>
          {data.roles.map((role) => (
            <div key={role.role_id} className={styles.infotile}>
              <p className={styles.itemMeta}>{role.role_name}</p>
              <p className={styles.text}>{role.description}</p>
              <p className={styles.textHead}>{role.permissions_json.length} permissions</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.textPrimary}>{label}</span>
      {children}
    </label>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className={styles.data}>
    <table className={styles.table}>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} className={styles.itemDatatable}>{header}</th>
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
                  styles.cell,
                  isNumericDisplay(cell) && styles.tableCell,
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
    <div className={styles.filterbarStatuscatalogview}>
      <Card>
        <CardHeader><SectionTitle title="Task statuses" /></CardHeader>
        <CardBody className={styles.statuscatalog}>{taskStatuses.map((status) => <StatusPill key={status} status={status} />)}</CardBody>
      </Card>
      <Card>
        <CardHeader><SectionTitle title="Project statuses" /></CardHeader>
        <CardBody className={styles.statuscatalog}>{projectStatuses.map((status) => <StatusPill key={status} status={status} />)}</CardBody>
      </Card>
    </div>
  );
}
