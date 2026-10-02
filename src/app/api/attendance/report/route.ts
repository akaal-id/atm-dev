import { NextResponse, type NextRequest } from "next/server";

import { daysBetween, MAX_REPORT_DAYS } from "@/lib/attendance-history";
import { requireApiPermission } from "@/lib/server/api";
import { getAttendanceHistory } from "@/lib/server/attendance-history";
import { listResource } from "@/lib/server/store";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Attendance rows for the report, `?start=YYYY-MM-DD&end=YYYY-MM-DD` (max 366 days), active company only. */
export async function GET(request: NextRequest) {
  const access = await requireApiPermission("attendance:team");
  if ("error" in access) return access.error;

  const start = request.nextUrl.searchParams.get("start") ?? "";
  const end = request.nextUrl.searchParams.get("end") ?? "";
  if (!DATE.test(start) || !DATE.test(end) || end < start) {
    return NextResponse.json({ error: "Choose a valid start and end date." }, { status: 400 });
  }
  if (daysBetween(start, end) > MAX_REPORT_DAYS) {
    return NextResponse.json({ error: `A report can cover at most ${MAX_REPORT_DAYS} days.` }, { status: 400 });
  }

  const users = await listResource("Users");
  const rows = await getAttendanceHistory(start, end, users);
  return NextResponse.json({ data: rows });
}
