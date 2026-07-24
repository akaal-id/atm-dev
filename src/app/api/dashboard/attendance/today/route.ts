import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/server/api";
import { DEFAULT_COMPANY_ID, getActiveCompanyContext, listCompanyMemberUserIds } from "@/lib/server/company-context";
import { listResource } from "@/lib/server/store";
import { getClockStatus, getTodayAttendance, jakartaToday } from "@/lib/metrics";
import type { Attendance } from "@/lib/types";

function attendanceBelongsToCompany(record: Attendance | undefined, companyId: string) {
  if (!record) return true;
  const scoped = (record.company_id ?? "").trim();
  if (!scoped) return companyId === DEFAULT_COMPANY_ID;
  return scoped === companyId;
}

/**
 * GET /api/dashboard/attendance/today
 * Team attendance status for the active company (today).
 */
export async function GET() {
  const access = await requireApiPermission("dashboard:view");
  if (access.error) return access.error;

  const context = await getActiveCompanyContext(access.user.user_id);
  const companyId = context.company.id;
  const [users, attendance, memberIds] = await Promise.all([
    listResource("Users"),
    listResource("Attendance"),
    listCompanyMemberUserIds(companyId),
  ]);

  const companyMemberIds = new Set(
    memberIds.length > 0 ? memberIds : users.filter((user) => user.is_active).map((user) => user.user_id),
  );

  const data = users
    .filter((user) => user.is_active && companyMemberIds.has(user.user_id))
    .map((user) => {
      const record = getTodayAttendance(attendance, user.user_id);
      const scopedRecord = attendanceBelongsToCompany(record, companyId) ? record : undefined;
      const clock = getClockStatus(scopedRecord);
      return {
        user_id: user.user_id,
        full_name: user.full_name,
        profile_photo: user.profile_photo,
        department_id: user.department_id,
        status: scopedRecord?.status ?? clock.value,
        clock_in: scopedRecord?.clock_in ?? "",
        clock_out: scopedRecord?.clock_out ?? "",
        clock,
        attendance_id: scopedRecord?.attendance_id ?? null,
      };
    })
    .sort((left, right) => left.full_name.localeCompare(right.full_name));

  return NextResponse.json({
    active_company_id: companyId,
    date: jakartaToday(),
    count: data.length,
    data,
  });
}
