import { NextResponse, type NextRequest } from "next/server";

import { awardPunctualAttendancePoints } from "@/lib/server/gamification";
import { readPayload, redirectBack, requireApiPermission, wantsJson } from "@/lib/server/api";
import { createResource, listResource, updateResource } from "@/lib/server/store";

function jakartaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function jakartaTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission("attendance:own");
  if (access.error) return access.error;

  const payload = await readPayload(request);
  const action = String(payload.action ?? "clock_in");
  const date = jakartaDate();
  const time = jakartaTime();
  const attendance = await listResource("Attendance");
  const existing = attendance.find((record) => record.user_id === access.user.user_id && record.date === date);

  if (action === "clock_out" && existing) {
    const record = await updateResource("Attendance", existing.attendance_id, { clock_out: time, updated_at: new Date().toISOString() });
    return wantsJson(request) ? NextResponse.json({ data: record }) : redirectBack(request, "/attendance");
  }

  if (existing) {
    const record = await updateResource("Attendance", existing.attendance_id, { clock_in: existing.clock_in || time, updated_at: new Date().toISOString() });
    if (record) await awardPunctualAttendancePoints(record);
    return wantsJson(request) ? NextResponse.json({ data: record }) : redirectBack(request, "/attendance");
  }

  const status = time > "09:10" ? "Late" : "Present";
  const record = await createResource("Attendance", {
    user_id: access.user.user_id,
    date,
    clock_in: time,
    clock_out: "",
    status,
    note: "",
    approval_status: status === "Late" ? "Pending Approval" : "Not Required",
    approved_by: "",
  });
  await awardPunctualAttendancePoints(record);

  return wantsJson(request) ? NextResponse.json({ data: record }, { status: 201 }) : redirectBack(request, "/attendance");
}
