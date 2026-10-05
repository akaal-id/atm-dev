import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { sendPushToEndpoint } from "@/lib/server/push";

/** Sends a test notification to this device only, so people can confirm their OS shows ATM alerts. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "This device isn't subscribed yet." }, { status: 400 });
  try {
    const sent = await sendPushToEndpoint(user.user_id, body.endpoint, {
      title: "ATM notifications are on ✅",
      body: "This is a test. Task, approval, and chat alerts will look like this.",
      url: "/notifications",
      tag: "push-test",
    });
    if (!sent) return NextResponse.json({ error: "This device isn't registered. Turn notifications off and on again." }, { status: 404 });
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The push service rejected the test." }, { status: 502 });
  }
}
