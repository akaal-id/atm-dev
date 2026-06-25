"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, CheckSquare, FolderKanban, FolderOpen, ListFilter, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { TaskBoard } from "@/components/app/task-board";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DateRangePickerField } from "@/components/ui/date-range-picker-field";
import { FilterSelect } from "@/components/ui/filter-select";
import { LinkifiedText } from "@/components/ui/linkified-text";
import { StatusPill, TaskStatusPill, statusTone } from "@/components/ui/status-pill";
import { activeTasks, completedTasks, jakartaToday } from "@/lib/metrics";
import { visibleTaskLabels } from "@/lib/task-approval";
import type { CurrentUser, Project, Task, User } from "@/lib/types";
import { cn, formatShortDate, groupBy } from "@/lib/utils";
import styles from "./task-workspace.module.css";

type TaskViewMode = "board" | "list" | "calendar" | "project";
type TaskScope = "my" | "team";

type TaskFilters = {
  query: string;
  projectId: string;
  dueDateFrom: string;
  dueDateTo: string;
  assigneeId: string;
  assignedById: string;
};

const NO_PROJECT = "__no_project";
const ALL = "all";
const viewTabs: Array<TabItem & { id: TaskViewMode }> = [
  { id: "board", label: "Board", icon: <CheckSquare /> },
  { id: "list", label: "List", icon: <ListFilter /> },
  { id: "calendar", label: "Calendar", icon: <CalendarDays /> },
  { id: "project", label: "Project", icon: <FolderKanban /> },
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

function shiftMonthKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calendarMonthOptions(tasks: Task[]) {
  const todayMonth = currentMonthKey();
  const keys = new Set<string>([todayMonth]);

  for (let delta = -1; delta <= 24; delta += 1) {
    keys.add(shiftMonthKey(todayMonth, delta));
  }

  tasks.forEach((task) => {
    const month = dateKey(task.due_date).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) keys.add(month);
  });

  return Array.from(keys)
    .sort((left, right) => right.localeCompare(left))
    .map((value) => ({ value, label: monthTitle(value) }));
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

    if (filters.dueDateFrom || filters.dueDateTo) {
      const taskDueDate = dateKey(task.due_date);
      if (filters.dueDateFrom && taskDueDate < filters.dueDateFrom) return false;
      if (filters.dueDateTo && taskDueDate > filters.dueDateTo) return false;
    }
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
      visibleTaskLabels(task.labels).join(" "),
      userName(users, task.assigned_by),
      assigneeNames,
      projectName(projects, task.project_id),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
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

type ListSortKey = "task" | "project" | "date" | "for" | "from" | "status";
type ListSort = { key: ListSortKey; direction: "asc" | "desc" };

const LIST_SORT_COLUMNS: Array<{ key: ListSortKey; label: string }> = [
  { key: "task", label: "Task" },
  { key: "project", label: "Project" },
  { key: "date", label: "Date" },
  { key: "for", label: "For" },
  { key: "from", label: "From" },
  { key: "status", label: "Status" },
];

function assigneeLabel(task: Task, users: User[]) {
  const names = task.assigned_to.map((id) => userName(users, id));
  return names.length > 0 ? names.join(", ") : "Unassigned";
}

function sortListTasks(tasks: Task[], users: User[], projects: Project[], sort: ListSort | null) {
  if (!sort) return tasks;

  const direction = sort.direction === "asc" ? 1 : -1;

  return [...tasks].sort((left, right) => {
    let comparison = 0;

    switch (sort.key) {
      case "task":
        comparison = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
        break;
      case "project":
        comparison = projectName(projects, left.project_id).localeCompare(projectName(projects, right.project_id), undefined, {
          sensitivity: "base",
        });
        break;
      case "date":
        comparison = dateKey(left.due_date).localeCompare(dateKey(right.due_date));
        break;
      case "for":
        comparison = assigneeLabel(left, users).localeCompare(assigneeLabel(right, users), undefined, { sensitivity: "base" });
        break;
      case "from":
        comparison = userName(users, left.assigned_by).localeCompare(userName(users, right.assigned_by), undefined, {
          sensitivity: "base",
        });
        break;
      case "status":
        comparison = left.status.localeCompare(right.status, undefined, { sensitivity: "base" });
        break;
    }

    return comparison * direction;
  });
}

function ListSortIcon({ direction }: { direction?: ListSort["direction"] }) {
  if (direction === "asc") return <ArrowUp className={styles.listHeaderSortIcon} aria-hidden="true" />;
  if (direction === "desc") return <ArrowDown className={styles.listHeaderSortIcon} aria-hidden="true" />;
  return <ArrowUpDown className={styles.listHeaderSortIconMuted} aria-hidden="true" />;
}

function TaskListHeader({
  sort,
  onSort,
}: {
  sort: ListSort | null;
  onSort: (key: ListSortKey) => void;
}) {
  return (
    <div className={styles.listHeaderBar}>
      <div className={styles.listHeader} role="row">
        {LIST_SORT_COLUMNS.map((column) => {
          const isActive = sort?.key === column.key;

          return (
            <button
              key={column.key}
              type="button"
              role="columnheader"
              aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => onSort(column.key)}
              className={cn(styles.listHeaderCell, isActive && styles.listHeaderCellActive)}
            >
              <span>{column.label}</span>
              <ListSortIcon direction={isActive ? sort.direction : undefined} />
            </button>
          );
        })}
      </div>
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
          {visibleTaskLabels(task.labels).slice(0, 2).map((label) => (
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

      <div className={cn(styles.cell, styles.statusCell)}>
        <p className={styles.cellLabel}>Status</p>
        <TaskStatusPill status={task.status} dueDate={task.due_date} handedOffAt={task.handed_off_at} />
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
  currentUser,
}: {
  filters: TaskFilters;
  setFilters: React.Dispatch<React.SetStateAction<TaskFilters>>;
  projects: Project[];
  users: User[];
  scope: TaskScope;
  currentUser: CurrentUser;
}) {
  const activeUsers = users.filter((user) => user.is_active);
  const projectOptions = [
    { value: ALL, label: "All projects" },
    { value: NO_PROJECT, label: "No project" },
    ...projects.map((project) => ({ value: project.project_id, label: project.project_name })),
  ];
  const userOptions = [
    { value: ALL, label: "Anyone" },
    ...activeUsers.map((user) => ({ value: user.user_id, label: user.full_name })),
  ];
  const assigneeOptions =
    scope === "my"
      ? [{ value: currentUser.user_id, label: currentUser.full_name }]
      : userOptions;

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
        <FilterSelect
          label="Project"
          value={filters.projectId}
          options={projectOptions}
          onValueChange={(projectId) => setFilters((current) => ({ ...current, projectId }))}
        />

        <DateRangePickerField
          label="Due date"
          value={{ from: filters.dueDateFrom, to: filters.dueDateTo }}
          onChange={({ from, to }) => setFilters((current) => ({ ...current, dueDateFrom: from, dueDateTo: to }))}
        />

        <FilterSelect
          label="For assignee"
          value={scope === "my" ? currentUser.user_id : filters.assigneeId}
          options={assigneeOptions}
          disabled={scope === "my"}
          onValueChange={(assigneeId) => setFilters((current) => ({ ...current, assigneeId }))}
        />

        <FilterSelect
          label="From assigner"
          value={filters.assignedById}
          options={userOptions}
          onValueChange={(assignedById) => setFilters((current) => ({ ...current, assignedById }))}
        />
      </div>
    </div>
  );
}

function ListView({
  filteredTasks,
  users,
  projects,
}: {
  filteredTasks: Task[];
  users: User[];
  projects: Project[];
}) {
  const [sort, setSort] = useState<ListSort | null>(null);

  const sortedTasks = useMemo(() => sortListTasks(filteredTasks, users, projects, sort), [filteredTasks, projects, sort, users]);

  const cycleSort = (key: ListSortKey) => {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  return (
    <div className={styles.cardGrid}>
      <TaskListHeader sort={sort} onSort={cycleSort} />

      {sortedTasks.length > 0 ? (
        sortedTasks.map((task) => <TaskListRow key={task.task_id} task={task} users={users} projects={projects} />)
      ) : (
        <div className={styles.empty}>No tasks match this list filter.</div>
      )}
    </div>
  );
}

const calendarTaskToneClass = {
  neutral: styles.calendarTaskNeutral,
  blue: styles.calendarTaskBlue,
  green: styles.calendarTaskGreen,
  yellow: styles.calendarTaskYellow,
  red: styles.calendarTaskRed,
  purple: styles.calendarTaskPurple,
} as const;

function CalendarTaskView({ tasks, users }: { tasks: Task[]; users: User[] }) {
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const today = jakartaToday();
  const monthOptions = useMemo(() => calendarMonthOptions(tasks), [tasks]);
  const cells = monthCells(monthKey);
  const monthTasks = tasks
    .filter((task) => dateKey(task.due_date).startsWith(monthKey))
    .sort((left, right) => left.due_date.localeCompare(right.due_date) || left.title.localeCompare(right.title));
  const grouped = groupBy(monthTasks, (task) => dateKey(task.due_date));
  const urgentCount = monthTasks.filter((task) => task.priority === "Urgent").length;

  return (
    <div className={styles.calendarLayout}>
      <div className={styles.monthCard}>
        <FilterSelect
          value={monthKey}
          options={monthOptions}
          onValueChange={setMonthKey}
          fullWidth={false}
          className={styles.monthSelect}
        />
        <div className={styles.monthCardBadges}>
          <Badge tone="blue">{monthTasks.length} tasks</Badge>
          <Badge tone={urgentCount > 0 ? "red" : "neutral"}>{urgentCount} urgent</Badge>
        </div>
      </div>

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
                        {dayTasks.slice(0, 4).map((task) => {
                          const tone = statusTone(task.status);

                          return (
                            <Link
                              key={task.task_id}
                              href={`/tasks/${task.task_id}`}
                              className={cn(styles.calendarTask, calendarTaskToneClass[tone])}
                              title={task.status}
                            >
                              <span className={styles.calendarTaskTitle}>{task.title}</span>
                              <span className={styles.calendarTaskMeta}>{task.priority} / {userName(users, task.assigned_by)}</span>
                            </Link>
                          );
                        })}
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
    <Link href={`/tasks/${task.task_id}`} className={cn(styles.projectTaskCard, "block rounded-lg border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50")}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <TicketId id={task.task_id} />
          <p className="mt-2 break-words text-sm font-bold text-slate-950">{task.title}</p>
        </div>
        <div className="shrink-0">
          <TaskStatusPill status={task.status} dueDate={task.due_date} handedOffAt={task.handed_off_at} />
        </div>
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

            {project ? (
              <Link
                href={`/project-files?project=${project.project_id}`}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 w-full")}
              >
                <FolderOpen className="h-4 w-4" />
                Project Files
              </Link>
            ) : null}

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
    dueDateFrom: "",
    dueDateTo: "",
    assigneeId: ALL,
    assignedById: ALL,
  });
  const taskBoardUsers = useMemo(() => users.map((user) => ({ user_id: user.user_id, full_name: user.full_name })), [users]);
  const filteredTasks = useMemo(() => filterTasks(tasks, users, projects, filters), [filters, projects, tasks, users]);
  const activeCount = activeTasks(tasks).length;
  const doneCount = completedTasks(tasks).length;
  const showFilters = activeView === "board" || activeView === "list" || activeView === "calendar";

  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <Tabs
          items={viewTabs}
          value={activeView}
          onValueChange={(value) => setActiveView(value as TaskViewMode)}
          aria-label={`${scope === "my" ? "My" : "Team"} task views`}
        />
        <div className={styles.toolbarActions}>{action}</div>
      </div>

      <div className={styles.summary}>
        {showFilters ? <Badge tone="blue">{filteredTasks.length} shown</Badge> : null}
        <Badge tone="blue">{tasks.length} {showFilters ? "total" : "tasks"}</Badge>
        <Badge>{activeCount} active</Badge>
        <Badge tone="green">{doneCount} done</Badge>
        {scope === "my" ? <Badge tone="purple">Assigned to {currentUser.full_name}</Badge> : <Badge tone="purple">All team tasks</Badge>}
      </div>

      {showFilters ? (
        <TaskFiltersPanel
          filters={filters}
          setFilters={setFilters}
          projects={projects}
          users={users}
          scope={scope}
          currentUser={currentUser}
        />
      ) : null}

      {activeView === "board" ? <TaskBoard tasks={filteredTasks} users={taskBoardUsers} canMoveFinished={canMoveFinished} /> : null}
      {activeView === "list" ? <ListView filteredTasks={filteredTasks} users={users} projects={projects} /> : null}
      {activeView === "calendar" ? <CalendarTaskView tasks={filteredTasks} users={users} /> : null}
      {activeView === "project" ? <ProjectTaskView tasks={tasks} users={users} projects={projects} /> : null}
    </div>
  );
}
