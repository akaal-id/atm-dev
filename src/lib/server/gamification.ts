import "server-only";

import { createResource, listResource } from "@/lib/server/store";
import { isTaskOverdue } from "@/lib/metrics";
import type { Attendance, Task } from "@/lib/types";

const completedTaskStatuses = new Set(["Finished", "Done", "Approved", "Completed"]);

const fallbackRules = {
  completeTask: 50,
  punctualAttendance: 10,
  overdueTask: -20,
};

async function gamificationRules() {
  const settings = await listResource("Settings");
  const rulesSetting = settings.find((setting) => setting.setting_key === "gamification_rules");

  if (!rulesSetting?.setting_value) return fallbackRules;

  try {
    const parsed = JSON.parse(rulesSetting.setting_value) as Partial<typeof fallbackRules>;
    return {
      completeTask: Number(parsed.completeTask ?? fallbackRules.completeTask),
      punctualAttendance: Number(parsed.punctualAttendance ?? fallbackRules.punctualAttendance),
      overdueTask: Number(parsed.overdueTask ?? fallbackRules.overdueTask),
    };
  } catch {
    return fallbackRules;
  }
}

export async function awardPointsOnce({
  userId,
  sourceType,
  sourceId,
  points,
  reason,
}: {
  userId: string;
  sourceType: string;
  sourceId: string;
  points: number;
  reason: string;
}) {
  if (!userId || !sourceType || !sourceId || points === 0) return null;

  const existing = await listResource("Gamification_Points");
  const alreadyAwarded = existing.some(
    (point) => point.user_id === userId && point.source_type === sourceType && point.source_id === sourceId,
  );

  if (alreadyAwarded) return null;

  return createResource("Gamification_Points", {
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId,
    points,
    reason,
    created_at: new Date().toISOString(),
  });
}

export async function awardTaskDonePoints(task: Pick<Task, "task_id" | "title">, userId: string) {
  const rules = await gamificationRules();

  return awardPointsOnce({
    userId,
    sourceType: "task_done",
    sourceId: task.task_id,
    points: rules.completeTask,
    reason: `Completed task: ${task.title}`,
  });
}

export async function awardPunctualAttendancePoints(attendance: Pick<Attendance, "attendance_id" | "status" | "date" | "user_id">) {
  if (attendance.status !== "Present") return null;

  const rules = await gamificationRules();

  return awardPointsOnce({
    userId: attendance.user_id,
    sourceType: "punctual_attendance",
    sourceId: attendance.attendance_id,
    points: rules.punctualAttendance,
    reason: `Punctual attendance on ${attendance.date}`,
  });
}

export async function syncLeaderboardPoints() {
  const [tasks, attendance, existingPoints, rules] = await Promise.all([
    listResource("Tasks"),
    listResource("Attendance"),
    listResource("Gamification_Points"),
    gamificationRules(),
  ]);
  const existingKeys = new Set(existingPoints.map((point) => `${point.user_id}:${point.source_type}:${point.source_id}`));
  const awards: Array<Promise<unknown>> = [];

  const awardMissing = ({ userId, sourceType, sourceId, points, reason }: { userId: string; sourceType: string; sourceId: string; points: number; reason: string }) => {
    const key = `${userId}:${sourceType}:${sourceId}`;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    awards.push(
      createResource("Gamification_Points", {
        user_id: userId,
        source_type: sourceType,
        source_id: sourceId,
        points,
        reason,
        created_at: new Date().toISOString(),
      }),
    );
  };

  tasks
    .filter((task) => completedTaskStatuses.has(task.status))
    .forEach((task) => {
      task.assigned_to.forEach((userId) => {
        awardMissing({
          userId,
          sourceType: "task_done",
          sourceId: task.task_id,
          points: rules.completeTask,
          reason: `Completed task: ${task.title}`,
        });
      });
    });

  // Deduct points once per assignee when a task slips past its due date.
  if (rules.overdueTask !== 0) {
    tasks
      .filter((task) => isTaskOverdue(task))
      .forEach((task) => {
        task.assigned_to.forEach((userId) => {
          awardMissing({
            userId,
            sourceType: "task_overdue",
            sourceId: task.task_id,
            points: rules.overdueTask,
            reason: `Overdue task: ${task.title}`,
          });
        });
      });
  }

  attendance
    .filter((record) => record.status === "Present")
    .forEach((record) => {
      awardMissing({
        userId: record.user_id,
        sourceType: "punctual_attendance",
        sourceId: record.attendance_id,
        points: rules.punctualAttendance,
        reason: `Punctual attendance on ${record.date}`,
      });
    });

  await Promise.all(awards);
}
