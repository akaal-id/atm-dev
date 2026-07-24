import { NextResponse } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/server/auth";
import { DEFAULT_COMPANY_ID, getActiveCompanyContext } from "@/lib/server/company-context";
import { listResource } from "@/lib/server/store";
import type { ActivityLog } from "@/lib/types";

function activityBelongsToCompany(log: ActivityLog, companyId: string) {
  const scoped = (log.company_id ?? "").trim();
  if (!scoped) return companyId === DEFAULT_COMPANY_ID;
  return scoped === companyId;
}

/**
 * GET /api/dashboard/activity/recent
 * Latest 10 activity log entries for the active company.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView =
    hasPermission(user.role_id, "dashboard:view") || hasPermission(user.role_id, "admin:view");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const context = await getActiveCompanyContext(user.user_id);
  const companyId = context.company.id;
  const logs = await listResource("Activity_Logs");

  const data = logs
    .filter((log) => activityBelongsToCompany(log, companyId))
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 10);

  return NextResponse.json({
    active_company_id: companyId,
    count: data.length,
    data,
  });
}
