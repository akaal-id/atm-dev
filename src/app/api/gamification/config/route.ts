import { NextResponse, type NextRequest } from "next/server";

import { hasAnyPermission } from "@/lib/permissions";
import { parseScoringConfig, scoreTracks } from "@/lib/scoring";
import { requireApiPermission } from "@/lib/server/api";
import { getCurrentUser } from "@/lib/server/auth";
import { getScoringConfig, saveScoringConfig } from "@/lib/server/scoring";

/** Work types for the task form (any task user) — the full config for admins. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAnyPermission(user.role_id, ["tasks:own", "tasks:team", "tasks:manage"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const config = await getScoringConfig();
  return NextResponse.json({
    data: {
      workTypes: config.workTypes.filter((type) => type.active),
      tracks: scoreTracks,
      defaultEffort: config.defaultEffort,
      picShare: config.picShare,
    },
  });
}

/** Replace the scoring config (work types, targets, weights, multipliers). */
export async function PUT(request: NextRequest) {
  const access = await requireApiPermission("settings:manage");
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid config." }, { status: 400 });
  const config = parseScoringConfig(body);
  const ids = config.workTypes.map((type) => type.id);
  if (new Set(ids).size !== ids.length) return NextResponse.json({ error: "Work type ids must be unique." }, { status: 400 });
  await saveScoringConfig(config, access.user);
  return NextResponse.json({ data: config });
}
