import styles from "./project-overview.module.css";

import { CalendarRange, Crown, Target, UserRound } from "lucide-react";

import type { ProjectDashboardProps } from "@/components/app/project-dashboard/project-dashboard/project-dashboard";
import { ProjectKpiPanel } from "@/components/app/project-dashboard/project-kpi-panel";
import { ProjectStrategyPanel } from "@/components/app/project-dashboard/project-strategy-panel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Task } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Elapsed share of the project period and days left, from today's date. */
function periodProgress(start: string, end: string, today = new Date()) {
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return null;
  const total = endTime - startTime + DAY_MS;
  const elapsed = Math.min(Math.max(today.getTime() - startTime, 0), total);
  return {
    percent: (elapsed / total) * 100,
    daysLeft: Math.max(0, Math.ceil((endTime + DAY_MS - today.getTime()) / DAY_MS)),
    started: today.getTime() >= startTime,
  };
}

const taskBuckets: Array<{ label: string; statuses: Task["status"][] }> = [
  { label: "To do", statuses: ["To Do"] },
  { label: "In progress", statuses: ["In Progress"] },
  { label: "Review", statuses: ["Waiting Approval", "Ready"] },
  { label: "Finished", statuses: ["Finished"] },
];

export function ProjectOverview({ project, users, tasks, hub, canEdit, hubUnavailable }: ProjectDashboardProps) {
  const userById = new Map(users.map((user) => [user.user_id, user]));
  const pic = project.pic_user_id ? userById.get(project.pic_user_id) : undefined;
  const period = periodProgress(project.period_start ?? "", project.period_end ?? "");
  const team = [...new Set([project.owner_user_id, project.pic_user_id, ...project.members].filter(Boolean) as string[])]
    .map((id) => userById.get(id))
    .filter((user): user is NonNullable<typeof user> => Boolean(user));
  const activeTasks = tasks.filter((task) => task.status !== "Cancelled");
  const finished = activeTasks.filter((task) => task.status === "Finished").length;

  return (
    <div className={styles.grid}>
      <Card>
        <CardHeader>
          <h2 className={styles.cardTitle}>Project brief</h2>
        </CardHeader>
        <CardBody className={styles.briefBody}>
          <div className={styles.field}>
            <span className={styles.label}>
              <Target className={styles.icon} aria-hidden />
              Objective
            </span>
            {project.objective ? (
              <p className={styles.objective}>{project.objective}</p>
            ) : (
              <p className={styles.empty}>{canEdit ? "No objective yet — add one from Edit project." : "No objective yet."}</p>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>
              <CalendarRange className={styles.icon} aria-hidden />
              Period
            </span>
            {project.period_start && project.period_end ? (
              <>
                <p className={styles.value}>
                  {formatDate(project.period_start)} – {formatDate(project.period_end)}
                </p>
                {period ? (
                  <Progress
                    value={period.percent}
                    label={!period.started ? "Not started" : period.daysLeft > 0 ? `${period.daysLeft} days left` : "Period ended"}
                  />
                ) : null}
              </>
            ) : (
              <p className={styles.empty}>Not set{project.deadline ? ` · deadline ${formatDate(project.deadline)}` : ""}</p>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>
              <UserRound className={styles.icon} aria-hidden />
              Person in charge
            </span>
            {pic ? (
              <div className={styles.person}>
                <Avatar name={pic.full_name} image={pic.profile_photo} size="sm" />
                <div className={styles.personText}>
                  <p className={styles.value}>{pic.full_name}</p>
                  {pic.position ? <p className={styles.muted}>{pic.position}</p> : null}
                </div>
              </div>
            ) : (
              <p className={styles.empty}>Not assigned</p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className={styles.cardTitle}>Team · {team.length}</h2>
        </CardHeader>
        <CardBody>
          {team.length === 0 ? (
            <p className={styles.empty}>No members yet.</p>
          ) : (
            <ul className={styles.teamList}>
              {team.map((member) => (
                <li key={member.user_id} className={styles.person}>
                  <Avatar name={member.full_name} image={member.profile_photo} size="sm" />
                  <div className={styles.personText}>
                    <p className={styles.value}>{member.full_name}</p>
                    {member.position ? <p className={styles.muted}>{member.position}</p> : null}
                  </div>
                  <span className={styles.roles}>
                    {member.user_id === project.pic_user_id ? <Badge tone="green">PIC</Badge> : null}
                    {member.user_id === project.owner_user_id ? (
                      <Badge tone="neutral">
                        <Crown className={styles.badgeIcon} aria-hidden />
                        Owner
                      </Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className={styles.cardTitle}>Tasks · {activeTasks.length}</h2>
        </CardHeader>
        <CardBody className={styles.briefBody}>
          <Progress value={activeTasks.length ? (finished / activeTasks.length) * 100 : 0} label={`${finished} of ${activeTasks.length} finished`} />
          <dl className={styles.taskStats}>
            {taskBuckets.map((bucket) => (
              <div key={bucket.label} className={styles.taskStat}>
                <dt className={styles.muted}>{bucket.label}</dt>
                <dd className={styles.statValue}>{activeTasks.filter((task) => bucket.statuses.includes(task.status)).length}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {hubUnavailable ? null : (
        <>
          <ProjectKpiPanel projectId={project.project_id} kpis={hub.kpis} strategy={hub.strategy} canEdit={canEdit} />
          <ProjectStrategyPanel projectId={project.project_id} strategy={hub.strategy} content={hub.content} canEdit={canEdit} />
        </>
      )}
    </div>
  );
}
