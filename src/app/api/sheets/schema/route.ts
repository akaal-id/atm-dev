import { NextResponse } from "next/server";

import { googleSheetsDatabaseSchema } from "@/lib/data/schema";
import { AppsScriptResponseError, ensureAppsScriptHeaders, isAppsScriptConfigured, testAppsScriptConnection } from "@/lib/server/apps-script";
import { ensureSheetHeaders, isGoogleSheetsConfigured } from "@/lib/server/google-sheets";
import { requireApiPermission } from "@/lib/server/api";
import { isSupabaseConfigured, testSupabaseConnection } from "@/lib/server/supabase-store";

export async function GET() {
  const access = await requireApiPermission("settings:manage");
  if (access.error) return access.error;

  try {
    const connection = process.env.ATM_DATA_MODE === "supabase"
      ? await testSupabaseConnection()
      : process.env.ATM_DATA_MODE === "apps_script"
        ? await testAppsScriptConnection()
        : null;

    return NextResponse.json({
      configured: isGoogleSheetsConfigured() || isAppsScriptConfigured() || isSupabaseConfigured(),
      mode: process.env.ATM_DATA_MODE ?? "seed",
      connection,
      schema: googleSheetsDatabaseSchema,
    });
  } catch (error) {
    if (error instanceof AppsScriptResponseError) {
      return NextResponse.json(
        {
          configured: true,
          mode: process.env.ATM_DATA_MODE ?? "seed",
          error: error.message,
          status: error.status,
          preview: error.preview,
          schema: googleSheetsDatabaseSchema,
        },
        { status: 502 },
      );
    }

    throw error;
  }
}

export async function POST() {
  const access = await requireApiPermission("settings:manage");
  if (access.error) return access.error;

  if (process.env.ATM_DATA_MODE === "supabase") {
    const result = await testSupabaseConnection();
    return NextResponse.json(result);
  }

  const result = process.env.ATM_DATA_MODE === "apps_script" ? await ensureAppsScriptHeaders() : await ensureSheetHeaders();
  return NextResponse.json(result);
}
