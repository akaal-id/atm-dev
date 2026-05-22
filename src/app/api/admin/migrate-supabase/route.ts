import { NextResponse, type NextRequest } from "next/server";

import { requireApiPermission, redirectBack, wantsJson } from "@/lib/server/api";
import { getResourceIdField, listResource, resourceNames } from "@/lib/server/store";
import { isSupabaseConfigured, readSupabaseResource, updateSupabaseResource, upsertSupabaseResources } from "@/lib/server/supabase-store";

function normalizedEmail(record: Record<string, unknown>) {
  return String(record.email ?? "").trim().toLowerCase();
}

async function migrateUsers(records: Array<Record<string, unknown>>) {
  const existingUsers = await readSupabaseResource("Users");
  const existingById = new Map(existingUsers.map((user) => [String(user.user_id ?? ""), user]));
  const existingByEmail = new Map(
    existingUsers
      .map((user) => [normalizedEmail(user), user] as const)
      .filter(([email]) => email),
  );

  let migrated = 0;

  for (const record of records) {
    const userId = String(record.user_id ?? "");
    const email = normalizedEmail(record);
    const existing = existingById.get(userId) ?? (email ? existingByEmail.get(email) : undefined);

    if (existing?.user_id) {
      const updated = await updateSupabaseResource("Users", "user_id", String(existing.user_id), record);
      if (updated) {
        existingById.set(String(updated.user_id ?? userId), updated);
        if (email) existingByEmail.set(email, updated);
      }
    } else {
      await upsertSupabaseResources("Users", "user_id", [record]);
      existingById.set(userId, record);
      if (email) existingByEmail.set(email, record);
    }

    migrated += 1;
  }

  return migrated;
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission("settings:manage");
  if (access.error) return access.error;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }

  if (process.env.ATM_DATA_MODE === "supabase") {
    return NextResponse.json(
      { error: "Switch ATM_DATA_MODE to seed, apps_script, or sheets before migrating into Supabase." },
      { status: 400 },
    );
  }

  try {
    const migrated: Record<string, number> = {};

    for (const resource of resourceNames) {
      const rows = (await listResource(resource)) as unknown as Array<Record<string, unknown>>;
      migrated[resource] = resource === "Users"
        ? await migrateUsers(rows)
        : await upsertSupabaseResources(resource, getResourceIdField(resource), rows);
    }

    if (wantsJson(request)) {
      return NextResponse.json({ ok: true, migrated });
    }

    return redirectBack(request, "/admin/settings?supabase_migration=done");
  } catch (error) {
    console.error("Supabase migration failed", error);

    if (wantsJson(request)) {
      return NextResponse.json({ error: "Supabase migration failed. Check the server logs for the exact table and database message." }, { status: 502 });
    }

    return NextResponse.redirect(new URL("/admin/settings?supabase_migration=error", request.url));
  }
}
