import { NextResponse, type NextRequest } from "next/server";

import {
  createConversation,
  listConversationsForUser,
} from "@/lib/server/ai-chat-actions";
import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const conversations = await listConversationsForUser(user.user_id);
    return NextResponse.json({ data: conversations });
  } catch (error) {
    console.error("list AI conversations failed", error);
    return NextResponse.json({ error: "Failed to list conversations." }, { status: 502 });
  }
}

export async function POST(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const context = await getActiveCompanyContext(user.user_id);
    const conversation = await createConversation(user.user_id, context.company.id);
    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (error) {
    console.error("create AI conversation failed", error);
    return NextResponse.json({ error: "Failed to create conversation." }, { status: 502 });
  }
}
