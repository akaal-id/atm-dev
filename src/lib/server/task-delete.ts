import "server-only";

import { deleteResource, deleteResourcesByField, listResource, updateResource } from "@/lib/server/store";

export async function cascadeDeleteTaskDependents(taskId: string) {
  await deleteResourcesByField("Task_Checklists", "task_id", taskId);
  await deleteResourcesByField("Task_Comments", "task_id", taskId);

  const [calendarEvents, notifications, points] = await Promise.all([
    listResource("Calendar_Events"),
    listResource("Notifications"),
    listResource("Gamification_Points"),
  ]);

  const taskLink = `/tasks/${taskId}`;

  await Promise.all([
    ...calendarEvents
      .filter((event) => event.related_task_id === taskId)
      .map((event) => updateResource("Calendar_Events", event.event_id, { related_task_id: "" })),
    ...notifications
      .filter((notification) => notification.related_link === taskLink)
      .map((notification) => deleteResource("Notifications", notification.notification_id)),
    ...points
      .filter((point) => point.source_type === "task_done" && point.source_id === taskId)
      .map((point) => deleteResource("Gamification_Points", point.point_id)),
  ]);
}
