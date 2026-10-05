import styles from "./dashboard.module.css";

import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, ListTodo, Trophy } from "lucide-react";
import Link from "next/link";

import { LeaveRequestButton } from "@/components/app/leave-request-modal";
import { PageHero } from "@/components/app/page-header";
import { PushToggle } from "@/components/app/push-toggle";
import type { AppData } from "@/components/app/views";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TaskStatusPill } from "@/components/ui/status-pill";
import { activeTasks, activeUsers, announcementsForUser, daysUntilBirthday, getTodayAttendance, isTaskOverdue, jakartaToday, pendingLeaveRequests, upcomingBirthdays, visibleTasksForUser } from "@/lib/metrics";
import { canApproveTaskAsLeader, hasPermission } from "@/lib/permissions";
import type { MonthScore } from "@/lib/server/scoring";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const dayMs = 86_400_000;
const dayNumber = (date: string) => Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / dayMs);
const shiftDate = (date: string, days: number) => new Date((dayNumber(date) + days) * dayMs).toISOString().slice(0, 10);
const shortDate = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));

function dueLabel(task: Task, today: string) {
  if (!task.due_date) return { text: "No due date", tone: styles.dueMuted };
  const diff = dayNumber(task.due_date) - dayNumber(today);
  if (isTaskOverdue(task, today)) return { text: `${-diff}d overdue`, tone: styles.dueLate };
  if (diff === 0) return { text: "Today", tone: styles.dueSoon };
  if (diff === 1) return { text: "Tomorrow", tone: styles.dueSoon };
  return { text: shortDate(task.due_date), tone: styles.dueMuted };
}

type Extras = {
  monthScore?: MonthScore;
  /** Today's time-tracking sessions: work mode + status per user. */
  sessions: Record<string, { work_mode: string; status: string }>;
};

/** "Today" dashboard: what to do now, what needs me, and how the team is doing. */
export function DashboardView({ data, monthScore, sessions }: { data: AppData } & Extras) {
  const me = data.currentUser;
  const today = jakartaToday();
  const weekEnd = shiftDate(today, 6 - ((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const myActive = activeTasks(visibleTasksForUser(data.tasks, me.user_id));

  const overdue = myActive.filter((task) => isTaskOverdue(task, today)).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const dueToday = myActive.filter((task) => !isTaskOverdue(task, today) && task.due_date?.slice(0, 10) === today);
  const thisWeek = myActive.filter((task) => !isTaskOverdue(task, today) && task.due_date && task.due_date.slice(0, 10) > today && task.due_date.slice(0, 10) <= weekEnd);
  const later = myActive.filter((task) => !overdue.includes(task) && !dueToday.includes(task) && !thisWeek.includes(task)).sort((a, b) => (a.due_date || "9").localeCompare(b.due_date || "9"));
  const taskGroups = [
    { label: "Overdue", tasks: overdue, tone: styles.groupLate },
    { label: "Due today", tasks: dueToday, tone: styles.groupSoon },
    { label: "This week", tasks: thisWeek, tone: "" },
    { label: "Later", tasks: later, tone: "" },
  ];
  let budget = 8;
  const shownGroups = taskGroups
    .map((group) => {
      const tasks = group.tasks.slice(0, Math.max(0, budget));
      budget -= tasks.length;
      return { ...group, shown: tasks };
    })
    .filter((group) => group.shown.length);

  // Attendance today
  const myRecord = getTodayAttendance(data.attendance, me.user_id);
  const mySession = sessions[me.user_id];
  const team = activeUsers(data.users).filter((user) => user.role_id !== "org_owner");
  const present = team.filter((user) => getTodayAttendance(data.attendance, user.user_id)?.clock_in || sessions[user.user_id]);
  const modeCount = (mode: string) => team.filter((user) => sessions[user.user_id]?.work_mode === mode).length;
  const lateCount = team.filter((user) => getTodayAttendance(data.attendance, user.user_id)?.status === "Late" || sessions[user.user_id]?.status === "Late").length;

  // Needs attention
  const canApproveLeave = hasPermission(me.role_id, "attendance:approve");
  const canReviewTasks = canApproveTaskAsLeader(me);
  const pendingLeave = canApproveLeave ? pendingLeaveRequests(data.leaveRequests, { approverView: true }) : [];
  const awaitingReview = canReviewTasks
    ? data.tasks.filter((task) => task.status === "Waiting Approval").sort((a, b) => (a.handed_off_at || a.updated_at).localeCompare(b.handed_off_at || b.updated_at))
    : [];
  const myRequests = data.leaveRequests.filter((request) => request.user_id === me.user_id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const myWaiting = myActive.filter((task) => task.status === "Waiting Approval");
  const userName = new Map(data.users.map((user) => [user.user_id, user.full_name]));

  // Upcoming 7 days
  const horizon = shiftDate(today, 7);
  const events = data.calendarEvents
    .filter((event) => event.type !== "Birthday" && event.start_date?.slice(0, 10) >= today && event.start_date.slice(0, 10) <= horizon)
    .map((event) => ({ key: event.event_id, date: event.start_date.slice(0, 10), title: event.title, kind: event.type }));
  const birthdays = upcomingBirthdays(data.users, 7).map((user) => ({ key: `bd-${user.user_id}`, date: shiftDate(today, daysUntilBirthday(user.birthday)), title: `${user.full_name}'s birthday`, kind: "Birthday" }));
  const upcoming = [...events, ...birthdays].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  const announcements = announcementsForUser(data.announcements, me)
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.scheduled_at.localeCompare(a.scheduled_at))
    .slice(0, 3);

  const firstName = me.full_name.split(" ")[0] || me.full_name;
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jakarta" }).format(new Date());
  const summary = overdue.length
    ? `${overdue.length} overdue task${overdue.length > 1 ? "s" : ""} need${overdue.length > 1 ? "" : "s"} you first.`
    : dueToday.length
      ? `${dueToday.length} task${dueToday.length > 1 ? "s" : ""} due today.`
      : "Nothing overdue — a good day to get ahead.";
  const clockedIn = Boolean(myRecord?.clock_in || mySession);
  const attentionCount = pendingLeave.length + awaitingReview.length;

  return (
    <div className={styles.root}>
      <PageHero
        eyebrow={dateLabel}
        title={`Welcome back, ${firstName}`}
        description={summary}
        actions={
          <>
            <Link href="/attendance" className={cn(styles.clockPill, clockedIn ? styles.clockIn : styles.clockOut)}>
              <Clock3 aria-hidden />
              {clockedIn ? `Clocked in ${myRecord?.clock_in ?? ""}${mySession?.work_mode ? ` · ${mySession.work_mode}` : ""}` : "Not clocked in — open Attendance"}
            </Link>
            <LeaveRequestButton />
          </>
        }
      />

      <PushToggle mode="banner" />

      <div className={styles.stats}>
        <Link href="/tasks/my" className={styles.stat}>
          <ListTodo aria-hidden className={styles.statIcon} />
          <span className={styles.statLabel}>Open tasks</span>
          <strong className={styles.statValue}>{myActive.length}</strong>
          <span className={cn(styles.statDetail, overdue.length && styles.textLate)}>{overdue.length ? `${overdue.length} overdue` : "None overdue"}</span>
        </Link>
        <Link href="/tasks/my" className={styles.stat}>
          <CalendarClock aria-hidden className={styles.statIcon} />
          <span className={styles.statLabel}>Due this week</span>
          <strong className={styles.statValue}>{dueToday.length + thisWeek.length}</strong>
          <span className={styles.statDetail}>{dueToday.length} today</span>
        </Link>
        <Link href="/leaderboard" className={styles.stat}>
          <Trophy aria-hidden className={styles.statIcon} />
          <span className={styles.statLabel}>My score · this month</span>
          <strong className={styles.statValue}>{monthScore ? monthScore.score : "—"}</strong>
          <span className={styles.statDetail}>{monthScore ? `Rank #${monthScore.rank} of ${monthScore.of}` : "Not ranked"}</span>
        </Link>
        <Link href="/attendance" className={styles.stat}>
          <Clock3 aria-hidden className={styles.statIcon} />
          <span className={styles.statLabel}>Today</span>
          <strong className={styles.statValue}>{clockedIn ? myRecord?.clock_in || "In" : "—"}</strong>
          <span className={cn(styles.statDetail, !clockedIn && styles.textLate)}>
            {clockedIn ? [mySession?.work_mode, myRecord?.status ?? mySession?.status].filter(Boolean).join(" · ") : "Not clocked in"}
          </span>
        </Link>
      </div>

      <div className={styles.grid}>
        <Card className={styles.tasks}>
          <CardHeader className={styles.head}>
            <h2 className={styles.title}>My tasks</h2>
            <Link href="/tasks/my" className={styles.headLink}>
              View all {myActive.length}
            </Link>
          </CardHeader>
          <CardBody className={styles.flush}>
            {shownGroups.length === 0 ? (
              <p className={styles.empty}>
                <CheckCircle2 aria-hidden /> No open tasks. Nice.
              </p>
            ) : (
              shownGroups.map((group) => (
                <section key={group.label}>
                  <p className={cn(styles.groupLabel, group.tone)}>
                    {group.label} <span>{group.tasks.length}</span>
                  </p>
                  {group.shown.map((task) => {
                    const due = dueLabel(task, today);
                    return (
                      <Link key={task.task_id} href={`/tasks/${task.task_id}`} className={styles.taskRow}>
                        <span className={styles.taskId}>{task.task_id}</span>
                        <span className={styles.taskTitle}>{task.title}</span>
                        <span className={cn(styles.due, due.tone)}>{due.text}</span>
                        <span className={styles.taskStatus}>
                          <TaskStatusPill status={task.status} />
                        </span>
                      </Link>
                    );
                  })}
                </section>
              ))
            )}
          </CardBody>
        </Card>

        <div className={styles.side}>
          <Card>
            <CardHeader className={styles.head}>
              <h2 className={styles.title}>Needs attention</h2>
              {attentionCount ? <Badge tone="red">{attentionCount}</Badge> : null}
            </CardHeader>
            <CardBody className={styles.list}>
              {canApproveLeave || canReviewTasks ? (
                <>
                  {pendingLeave.slice(0, 3).map((request) => (
                    <Link key={request.request_id} href={`/attendance/approvals?type=${encodeURIComponent(request.request_type)}`} className={styles.item}>
                      <Badge tone="yellow">{request.request_type}</Badge>
                      <span className={styles.itemText}>
                        {userName.get(request.user_id) ?? "Someone"} · {shortDate(request.start_date)}
                        {request.end_date !== request.start_date ? ` – ${shortDate(request.end_date)}` : ""}
                      </span>
                    </Link>
                  ))}
                  {pendingLeave.length > 3 ? (
                    <Link href="/attendance/approvals" className={styles.more}>
                      +{pendingLeave.length - 3} more leave requests
                    </Link>
                  ) : null}
                  {awaitingReview.slice(0, 3).map((task) => (
                    <Link key={task.task_id} href={`/tasks/${task.task_id}`} className={styles.item}>
                      <Badge tone="purple">Review</Badge>
                      <span className={styles.itemText}>{task.title}</span>
                    </Link>
                  ))}
                  {awaitingReview.length > 3 ? (
                    <Link href="/admin/approval" className={styles.more}>
                      +{awaitingReview.length - 3} more tasks to review
                    </Link>
                  ) : null}
                  {attentionCount === 0 ? (
                    <p className={styles.allClear}>
                      <CheckCircle2 aria-hidden /> All caught up.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  {myWaiting.map((task) => (
                    <Link key={task.task_id} href={`/tasks/${task.task_id}`} className={styles.item}>
                      <Badge tone="purple">In review</Badge>
                      <span className={styles.itemText}>{task.title}</span>
                    </Link>
                  ))}
                  {myRequests.map((request) => (
                    <Link key={request.request_id} href="/attendance" className={styles.item}>
                      <Badge tone={request.status === "Approved" ? "green" : request.status === "Rejected" ? "red" : "yellow"}>{request.status === "Pending Approval" ? "Pending" : request.status}</Badge>
                      <span className={styles.itemText}>
                        {request.request_type} · {shortDate(request.start_date)}
                      </span>
                    </Link>
                  ))}
                  {myWaiting.length + myRequests.length === 0 ? (
                    <p className={styles.allClear}>
                      <CheckCircle2 aria-hidden /> Nothing waiting on you.
                    </p>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className={styles.head}>
              <h2 className={styles.title}>Team today</h2>
              {hasPermission(me.role_id, "attendance:team") ? (
                <Link href="/attendance/history?view=day" className={styles.headLink}>
                  Details
                </Link>
              ) : null}
            </CardHeader>
            <CardBody className={styles.team}>
              <div className={styles.teamCounts}>
                <span>
                  <strong>{present.length}</strong>/{team.length} in
                </span>
                <span>
                  <strong>{modeCount("WFO")}</strong> WFO
                </span>
                <span>
                  <strong>{modeCount("WFH")}</strong> WFH
                </span>
                <span className={modeCount("Off-site") ? styles.textLate : undefined}>
                  <strong>{modeCount("Off-site")}</strong> Off-site
                </span>
                <span className={lateCount ? styles.textWarn : undefined}>
                  <strong>{lateCount}</strong> late
                </span>
              </div>
              {present.length ? (
                <div className={styles.avatars}>
                  {present.slice(0, 10).map((user) => (
                    <span key={user.user_id} title={user.full_name}>
                      <Avatar name={user.full_name} image={user.profile_photo || undefined} size="sm" />
                    </span>
                  ))}
                  {present.length > 10 ? <span className={styles.moreAvatars}>+{present.length - 10}</span> : null}
                </div>
              ) : (
                <p className={styles.muted}>Nobody has clocked in yet.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className={styles.head}>
              <h2 className={styles.title}>Announcements</h2>
              <Link href="/announcements" className={styles.headLink}>
                View all
              </Link>
            </CardHeader>
            <CardBody className={styles.list}>
              {announcements.length === 0 ? <p className={styles.muted}>No announcements.</p> : null}
              {announcements.map((announcement) => (
                <Link key={announcement.announcement_id} href="/announcements" className={styles.announcement}>
                  <span className={styles.announcementHead}>
                    <Badge tone={announcement.is_pinned ? "yellow" : "blue"}>{announcement.category}</Badge>
                    {announcement.is_pinned ? <span className={styles.muted}>Pinned</span> : null}
                  </span>
                  <span className={styles.announcementTitle}>{announcement.title}</span>
                  <span className={styles.announcementBody}>{announcement.body}</span>
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className={styles.head}>
              <h2 className={styles.title}>Coming up</h2>
              <Link href="/calendar" className={styles.headLink}>
                Calendar
              </Link>
            </CardHeader>
            <CardBody className={styles.list}>
              {upcoming.length === 0 ? <p className={styles.muted}>Nothing in the next 7 days.</p> : null}
              {upcoming.map((item) => (
                <div key={item.key} className={styles.upcoming}>
                  <span className={cn(styles.dateChip, item.date === today && styles.dateToday)}>{item.date === today ? "Today" : shortDate(item.date)}</span>
                  <span className={styles.itemText}>{item.title}</span>
                  {item.kind === "Birthday" ? <span aria-label="Birthday">🎂</span> : <span className={styles.muted}>{item.kind}</span>}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {overdue.length >= 5 ? (
        <p className={styles.nudge}>
          <AlertTriangle aria-hidden />
          <span>
            {overdue.length} of your tasks are overdue. Hand off what&apos;s done or ask your leader to move the due date — overdue tasks lower your leaderboard
            timeliness.
          </span>
        </p>
      ) : null}
    </div>
  );
}
