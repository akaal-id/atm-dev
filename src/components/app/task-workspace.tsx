"use client";

import Link from "next/link";
import { CalendarDays, CheckSquare, FolderKanban, ListFilter, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { TaskBoard } from "@/components/app/task-board";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { StatusPill } from "@/components/ui/status-pill";
import { activeTasks, completedTasks, jakartaToday } from "@/lib/metrics";
import type { CurrentUser, Project, Task, User } from "@/lib/types";
import { cn, formatShortDate, groupBy } from "@/lib/utils";
import styles from "./task-workspace.module.css";

type TaskViewMode = "board" | "list" | "calendar" | "project";
type TaskScope = "my" | "team";

type TaskFilters = {
  query: string;
  projectId: string;
  dueDate: string;
  assigneeId: string;
  assignedById: string;
};

const NO_PROJECT = "__no_project";
const ALL = "all";
const viewTabs: Array<{ id: TaskViewMode; label: string }> = [
  { id: "board", label: "Board" },
  { id: "list", label: "List" },
  { id: "calendar", label: "Calendar" },
  { id: "project", label: "Project" },
];

function userName(users: User[], id: string) {
  return users.find((user) => user.user_id === id)?.full_name ?? "Unassigned";
}

function projectName(projects: Project[], id: string) {
  if (!id) return "No project";
  return projects.find((project) => project.project_id === id)?.project_name ?? "No project";
}

function projectCode(project?: Project) {
  return project?.ticket_id_prefix || project?.project_id || "NO";
}

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
  const cells: Array<string | null> = Array.from({ length: firstDay.getUTCDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${monthKey}-${String(day).padStart(2, "0")}`);
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function filterTasks(tasks: Task[], users: User[], projects: Project[], filters: TaskFilters) {
  const query = filters.query.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.projectId !== ALL) {
      const taskProject = task.project_id || NO_PROJECT;
      if (taskProject !== filters.projectId) return false;
    }

    if (filters.dueDate && dateKey(task.due_date) !== filters.dueDate) return false;
    if (filters.assigneeId !== ALL && !task.assigned_to.includes(filters.assigneeId)) return false;
    if (filters.assignedById !== ALL && task.assigned_by !== filters.assignedById) return false;

    if (!query) return true;

    const assigneeNames = task.assigned_to.map((id) => userName(users, id)).join(" ");
    const haystack = [
      task.task_id,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.labels.join(" "),
      userName(users, task.assigned_by),
      assigneeNames,
      projectName(projects, task.project_id),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function tabIcon(id: TaskViewMode) {
  if (id === "list") return <ListFilter className={styles.tabIcon} />;
  if (id === "calendar") return <CalendarDays className={styles.tabIcon} />;
  if (id === "project") return <FolderKanban className={styles.tabIcon} />;
  return <CheckSquare className={styles.tabIcon} />;
}

function TicketId({ id }: { id: string }) {
  return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">#{id}</code>;
}

function TaskAssignees({ task, users }: { task: Task; users: User[] }) {
  const names = task.assigned_to.map((id) => userName(users, id));

  return (
    <div className={styles.avatarLine}>
      <div className={styles.avatarStack}>
        {task.assigned_to.slice(0, 3).map((id) => (
          <Avatar key={id} name={userName(users, id)} size="sm" />
        ))}
      </div>
      <p className={styles.cellText}>{names.length > 0 ? names.join(", ") : "Unassigned"}</p>
    </div>
  );
}

function TaskListRow({ task, users, projects }: { task: Task; users: User[]; projects: Project[] }) {
  return (
    <article className={styles.listRow}>
      <div className={styles.taskMain}>
        <TicketId id={task.task_id} />
        <Link href={`/tasks/${task.task_id}`} className={styles.taskTitle}>
          {task.title}
        </Link>
        <LinkifiedText text={task.description} className={styles.taskDescription} />
        <div className={cn(styles.metaRow, "mt-3")}>
          <Badge tone={task.priority === "Urgent" ? "red" : task.priority === "High" ? "yellow" : "neutral"}>{task.priority}</Badge>
          {task.labels.slice(0, 2).map((label) => (
            <Badge key={label}>{label}</Badge>
          ))}
        </div>
      </div>

      <div className={styles.cell}>
        <p className={styles.cellLabel}>Project</p>
        <p className={styles.cellText}>{projectName(projects, task.project_id)}</p>
      </div>

      <div className={styles.cell}>
        <p className={styles.cellLabel}>Date</p>
        <p className={styles.cellText}>{formatShortDate(task.due_date)}</p>
      </div>

      <div className={styles.cell}>
        <p className={styles.cellLabel}>For</p>
        <TaskAssignees task={task} users={users} />
      </div>

      <div className={styles.cell}>
        <p className={styles.cellLabel}>From</p>
        <p className={styles.cellText}>{userName(users, task.assigned_by)}</p>
      </div>

      <div className={styles.cell}>
        <p className={styles.cellLabel}>Status</p>
        <StatusPill status={task.status} />
      </div>
    </article>
  );
}

function TaskFiltersPanel({
  filters,
  setFilters,
  projects,
  users,
  scope,
}: {
  filters: TaskFilters;
  setFilters: React.Dispatch<React.SetStateAction<TaskFilters>>;
  projects: Project[];
  users: User[];
  scope: TaskScope;
}) {
  const activeUsers = users.filter((user) => user.is_active);

  return (
    <div className={styles.filterPanel}>
      <label className={styles.searchField}>
        <Search className={styles.searchIcon} />
        <input
          value={filters.query}
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
          className={styles.searchInput}
          placeholder="Search task ID, title, assignee, label, or project"
        />
      </label>

      <div className={styles.filterGrid}>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Project</span>
          <select
            value={filters.projectId}
            onChange={(event) => setFilters((current) => ({ ...current, projectId: event.target.value }))}
            className={styles.filterControl}
          >
            <option value={ALL}>All projects</option>
            <option value={NO_PROJECT}>No project</option>
            {projects.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {project.project_name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Date</span>
          <input
            type="date"
            value={filters.dueDate}
            onChange={(event) => setFilters((current) => ({ ...current, dueDate: event.target.value }))}
            className={styles.filterControl}
          />
        </label>

        {scope === "team" ? (
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>For assignee</span>
            <select
              value={filters.assigneeId}
              onChange={(event) => setFilters((current) => ({ ...current, assigneeId: event.target.value }))}
              className={styles.filterControl}
            >
              <option value={ALL}>Anyone</option>
              {activeUsers.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={styles.filterField}>
          <span className={styles.filterLabel}>From assigner</span>
          <select
            value={filters.assignedById}
            onChange={(event) => setFilters((current) => ({ ...current, assignedById: event.target.value }))}
            className={styles.filterControl}
          >
            <option value={ALL}>Anyone</option>
            {activeUsers.map((user) => (
              <option key={user.user_id} value={user.user_id}>
                {user.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function ListView({
  tasks,
  filteredTasks,
  users,
  projects,
  filters,
  setFilters,
  scope,
}: {
  tasks: Task[];
  filteredTasks: Task[];
  users: User[];
  projects: Project[];
  filters: TaskFilters;
  setFilters: React.Dispatch<React.SetStateAction<TaskFilters>>;
  scope: TaskScope;
}) {
  return (
    <div className={styles.cardGrid}>
      <TaskFiltersPanel filters={filters} setFilters={setFilters} projects={projects} users={users} scope={scope} />
      <div className={styles.summary}>
        <Badge tone="blue">{filteredTasks.length} shown</Badge>
        <Badge>{tasks.length} total</Badge>
        {scope === "my" ? <Badge tone="green">Personalized to you</Badge> : <Badge tone="purple">Team view</Badge>}
      </div>

      <div className={styles.listHeader} aria-hidden="true">
        <span>Task</span>
        <span>Project</span>
        <span>Date</span>
        <span>For</span>
        <span>From</span>
        <span>Status</span>
      </div>

      {filteredTasks.length > 0 ? (
        filteredTasks.map((task) => <TaskListRow key={task.task_id} task={task} users={users} projects={projects} />)
      ) : (
        <div className={styles.empty}>No tasks match this list filter.</div>
      )}
    </div>
  );
}

function CalendarTaskView({ tasks, users }: { tasks: Task[]; users: User[] }) {
  const monthKey = currentMonthKey();
  const today = jakartaToday();
  const cells = monthCells(monthKey);
  const monthTasks = tasks
    .filter((task) => dateKey(task.due_date).startsWith(monthKey))
    .sort((left, right) => left.due_date.localeCompare(right.due_date) || left.title.localeCompare(right.title));
  const grouped = groupBy(monthTasks, (task) => dateKey(task.due_date));
  const urgentCount = monthTasks.filter((task) => task.priority === "Urgent").length;

  return (
    <div className={styles.calendarLayout}>
      <aside className={styles.monthSummary}>
        <div className={styles.monthCard}>
          <p className={styles.monthTitle}>{monthTitle(monthKey)}</p>
          <p className={styles.monthDetail}>Only task due dates are shown here.</p>
        </div>
        <div className={styles.monthCard}>
          <div className={styles.summary}>
            <Badge tone="blue">{monthTasks.length} tasks</Badge>
            <Badge tone={urgentCount > 0 ? "red" : "neutral"}>{urgentCount} urgent</Badge>
          </div>
        </div>
      </aside>

      <div className={styles.calendarScroll}>
        <div className={styles.calendar}>
          <div className={styles.weekdays}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className={styles.monthGrid}>
            {cells.map((date, index) => {
              const dayTasks = date ? grouped[date] ?? [] : [];

              return (
                <div
                  key={date ?? `empty-${index}`}
                  className={cn(styles.dayCell, !date && styles.dayCellMuted, date === today && styles.dayCellToday)}
                >
                  {date ? (
                    <>
                      <p className={styles.dayNumber}>{Number(date.slice(8, 10))}</p>
                      <div className={styles.dayTasks}>
                        {dayTasks.slice(0, 4).map((task) => (
                          <Link key={task.task_id} href={`/tasks/${task.task_id}`} className={styles.calendarTask}>
                            <span className={styles.calendarTaskTitle}>{task.title}</span>
                            <span className={styles.calendarTaskMeta}>{task.priority} / {userName(users, task.assigned_by)}</span>
                          </Link>
                        ))}
                        {dayTasks.length > 4 ? <p className="text-xs font-bold text-blue-600">+{dayTasks.length - 4} more</p> : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectTaskCard({ task, users }: { task: Task; users: User[] }) {
  return (
    <Link href={`/tasks/${task.task_id}`} className="block rounded-lg border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <TicketId id={task.task_id} />
          <p className="mt-2 break-words text-sm font-bold text-slate-950">{task.title}</p>
        </div>
        <StatusPill status={task.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={task.priority === "Urgent" ? "red" : task.priority === "High" ? "yellow" : "neutral"}>{task.priority}</Badge>
        <Badge>Due {formatShortDate(task.due_date)}</Badge>
      </div>
      <div className="mt-3">
        <TaskAssignees task={task} users={users} />
      </div>
    </Link>
  );
}

function ProjectTaskView({ tasks, users, projects }: { tasks: Task[]; users: User[]; projects: Project[] }) {
  const grouped = groupBy(tasks, (task) => task.project_id || NO_PROJECT);
  const groups = Object.entries(grouped)
    .map(([projectId, groupTasks]) => ({
      projectId,
      project: projects.find((project) => project.project_id === projectId),
      tasks: groupTasks.sort((left, right) => left.due_date.localeCompare(right.due_date) || left.title.localeCompare(right.title)),
    }))
    .sort((left, right) => {
      if (left.projectId === NO_PROJECT) return 1;
      if (right.projectId === NO_PROJECT) return -1;
      return projectName(projects, left.projectId).localeCompare(projectName(projects, right.projectId));
    });

  if (groups.length === 0) {
    return <div className={styles.empty}>No project task groups yet.</div>;
  }

  return (
    <div className={styles.projectGrid}>
      {groups.map(({ projectId, project, tasks: projectTasks }) => {
        const activeCount = activeTasks(projectTasks).length;
        const doneCount = completedTasks(projectTasks).length;

        return (
          <section key={projectId} className={styles.projectCard}>
            <div className={styles.projectHeader}>
              <div className="min-w-0">
                <TicketId id={projectId === NO_PROJECT ? "NO-PROJECT" : projectCode(project)} />
                <h2 className={styles.projectName}>{project?.project_name ?? "No project"}</h2>
                <p className={styles.projectMeta}>
                  {project ? `Owner: ${userName(users, project.owner_user_id)}` : "Tasks without a linked project"}
                </p>
              </div>
              {project ? <StatusPill status={project.status} /> : <Badge>No project</Badge>}
            </div>

            <div className={styles.projectStats}>
              <div className={styles.statTile}>
                <p className={styles.statLabel}>Tasks</p>
                <p className={styles.statValue}>{projectTasks.length}</p>
              </div>
              <div className={styles.statTile}>
                <p className={styles.statLabel}>Active</p>
                <p className={styles.statValue}>{activeCount}</p>
              </div>
              <div className={styles.statTile}>
                <p className={styles.statLabel}>Done</p>
                <p className={styles.statValue}>{doneCount}</p>
              </div>
              <div className={styles.statTile}>
                <p className={styles.statLabel}>Next due</p>
                <p className={styles.statValue}>{formatShortDate(projectTasks[0]?.due_date ?? "")}</p>
              </div>
            </div>

            <div className={styles.projectTasks}>
              {projectTasks.map((task) => (
                <ProjectTaskCard key={task.task_id} task={task} users={users} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function TaskWorkspace({
  tasks,
  users,
  projects,
  currentUser,
  scope,
  canMoveFinished,
  action,
}: {
  tasks: Task[];
  users: User[];
  projects: Project[];
  currentUser: CurrentUser;
  scope: TaskScope;
  canMoveFinished: boolean;
  action?: React.ReactNode;
}) {
  const [activeView, setActiveView] = useState<TaskViewMode>("board");
  const [filters, setFilters] = useState<TaskFilters>({
    query: "",
    projectId: ALL,
    dueDate: "",
    assigneeId: ALL,
    assignedById: ALL,
  });
  const taskBoardUsers = useMemo(() => users.map((user) => ({ user_id: user.user_id, full_name: user.full_name })), [users]);
  const filteredListTasks = useMemo(() => filterTasks(tasks, users, projects, filters), [filters, projects, tasks, users]);
  const activeCount = activeTasks(tasks).length;
  const doneCount = completedTasks(tasks).length;

  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label={`${scope === "my" ? "My" : "Team"} task views`}>
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeView === tab.id}
              onClick={() => setActiveView(tab.id)}
              className={cn(styles.tab, activeView === tab.id && styles.tabActive)}
            >
              {tabIcon(tab.id)}
              {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.toolbarActions}>{action}</div>
      </div>

      <div className={styles.summary}>
        <Badge tone="blue">{tasks.length} tasks</Badge>
        <Badge>{activeCount} active</Badge>
        <Badge tone="green">{doneCount} done</Badge>
        {scope === "my" ? <Badge tone="purple">Assigned to {currentUser.full_name}</Badge> : <Badge tone="purple">All team tasks</Badge>}
      </div>

      {activeView === "board" ? <TaskBoard tasks={tasks} users={taskBoardUsers} canMoveFinished={canMoveFinished} /> : null}
      {activeView === "list" ? (
        <ListView
          tasks={tasks}
          filteredTasks={filteredListTasks}
          users={users}
          projects={projects}
          filters={filters}
          setFilters={setFilters}
          scope={scope}
        />
      ) : null}
      {activeView === "calendar" ? <CalendarTaskView tasks={tasks} users={users} /> : null}
      {activeView === "project" ? <ProjectTaskView tasks={tasks} users={users} projects={projects} /> : null}
    </div>
  );
}
