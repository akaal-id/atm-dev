import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/server/api";
import { getActiveCompanyContext, DEFAULT_COMPANY_ID } from "@/lib/server/company-context";
import { listResource } from "@/lib/server/store";
import { activeTasks, jakartaToday, tasksDueOnDate, visibleTasksForUser } from "@/lib/metrics";
import type { Task } from "@/lib/types";

function taskBelongsToCompany(task: Task, companyId: string) {
  const scoped = (task.company_id ?? "").trim();
  if (!scoped) {
    // Legacy rows (pre-backfill) stay visible only under the default Akaal company.
    return companyId === DEFAULT_COMPANY_ID;
  }
  return scoped === companyId;
}

/**
 * GET /api/dashboard/tasks/today
 * Today's tasks for the signed-in user, scoped to their active company.
 */
export async function GET() {
  const access = await requireApiPermission("dashboard:view");
  if (access.error) return access.error;

  const context = await getActiveCompanyContext(access.user.user_id);
  const companyId = context.company.id;
  const allTasks = await listResource("Tasks");
  const mine = visibleTasksForUser(allTasks, access.user.user_id).filter((task) => taskBelongsToCompany(task, companyId));
  const dueToday = tasksDueOnDate(activeTasks(mine), jakartaToday());

  return NextResponse.json({
    active_company_id: companyId,
    date: jakartaToday(),
    count: dueToday.length,
    data: dueToday,
  });
}
