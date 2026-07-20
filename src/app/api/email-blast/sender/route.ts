import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { getSenderProfile, upsertSenderProfile } from "@/lib/server/email-blast-settings";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getSenderProfile(user.user_id);
  return NextResponse.json({
    data: {
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      sender_name: profile?.sender_name || user.full_name,
    },
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const senderName = String(payload?.sender_name ?? "").trim();
  if (!senderName) return NextResponse.json({ error: "sender_name is required." }, { status: 400 });

  try {
    const profile = await upsertSenderProfile(user.user_id, senderName);
    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update sender name." }, { status: 502 });
  }
}
