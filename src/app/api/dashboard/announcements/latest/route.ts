import { NextResponse } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { DEFAULT_COMPANY_ID, getActiveCompanyContext } from "@/lib/server/company-context";
import { getCurrentUser } from "@/lib/server/auth";
import { listResource } from "@/lib/server/store";
import { announcementsForUser } from "@/lib/metrics";
import type { Announcement } from "@/lib/types";

function announcementBelongsToCompany(announcement: Announcement, companyId: string) {
  const scoped = (announcement.company_id ?? "").trim();
  if (!scoped) return companyId === DEFAULT_COMPANY_ID;
  return scoped === companyId;
}

/**
 * GET /api/dashboard/announcements/latest
 * Top 3 announcements for the active company (pinned first, then newest).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView =
    hasPermission(user.role_id, "announcements:view") || hasPermission(user.role_id, "dashboard:view");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const context = await getActiveCompanyContext(user.user_id);
  const companyId = context.company.id;
  const announcements = await listResource("Announcements");

  const data = announcementsForUser(announcements, user)
    .filter((announcement) => announcementBelongsToCompany(announcement, companyId))
    .sort((left, right) => {
      if (left.is_pinned !== right.is_pinned) return left.is_pinned ? -1 : 1;
      return right.scheduled_at.localeCompare(left.scheduled_at);
    })
    .slice(0, 3);

  return NextResponse.json({
    active_company_id: companyId,
    count: data.length,
    data,
  });
}
