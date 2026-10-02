import { NextResponse, type NextRequest } from "next/server";

import { DONE_STATUSES } from "@/lib/scoring";
import { getCurrentUser } from "@/lib/server/auth";
import { getScoringConfig } from "@/lib/server/scoring";
import { createResource, getResourceById, updateResource } from "@/lib/server/store";
import { canManageTaskScoring, sanitizeTaskScoring } from "@/lib/server/task-scoring";
import type { Task } from "@/lib/types";

const FIELDS = ["work_type_id", "effort_points", "pic_user_id", "contribution_shares", "quality_rating"] as const;

/** Leaders set a task's work type, effort, PIC, credit split and quality rating. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const task = (await getResourceById("Tasks", id)) as Task | undefined;
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  if (!canManageTaskScoring(user) && task.assigned_by !== user.user_id) {
    return NextResponse.json({ error: "Only the task's leader can change its scoring." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  const patch: Record<string, unknown> = Object.fromEntries(FIELDS.filter((key) => key in body).map((key) => [key, body[key]]));
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  sanitizeTaskScoring(patch, { config: await getScoringConfig(), assignees: task.assigned_to, canManage: true });

  // updated_at moves on every write; pin the completion date so a finished task stays in its period.
  if (DONE_STATUSES.has(task.status) && !task.completed_at) patch.completed_at = task.updated_at;
  const record = await updateResource("Tasks", id, patch as never);
  await createResource("Activity_Logs", {
    user_id: user.user_id,
    action: "updated",
    entity_type: "Tasks",
    entity_id: id,
    description: `${user.full_name} updated scoring for ${id} (${Object.keys(patch).join(", ")}).`,
    created_at: new Date().toISOString(),
  });
  return NextResponse.json({ data: record });
}
