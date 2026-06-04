import { NextResponse, type NextRequest } from "next/server";

import {
  AttendanceTimeTrackingError,
  assertAttendanceEventType,
  assertLatitude,
  assertLongitude,
  getTodayAttendanceTerminalState,
  logAttendanceEvent,
} from "@/lib/server/attendance-time-tracking";
import { requireApiPermission } from "@/lib/server/api";

function errorResponse(error: unknown) {
  if (error instanceof AttendanceTimeTrackingError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "Unable to process attendance event." }, { status: 500 });
}

async function readJsonPayload(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new AttendanceTimeTrackingError("Invalid JSON body.", 400);
  }
}

export async function GET() {
  const access = await requireApiPermission("attendance:own");
  if ("error" in access) return access.error;

  try {
    const data = await getTodayAttendanceTerminalState(access.user.user_id);
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission("attendance:own");
  if ("error" in access) return access.error;

  try {
    const payload = await readJsonPayload(request);
    const eventType = assertAttendanceEventType(payload.event_type);
    const lat = assertLatitude(payload.lat);
    const lng = assertLongitude(payload.lng);
    const eodSummary = typeof payload.eod_summary === "string" ? payload.eod_summary : undefined;

    const data = await logAttendanceEvent({
      eodSummary,
      eventType,
      lat,
      lng,
      userId: access.user.user_id,
    });

    return NextResponse.json({ data }, { status: eventType === "clock_in" ? 201 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
