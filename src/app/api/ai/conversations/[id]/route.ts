import { NextResponse, type NextRequest } from "next/server";
import type { UIMessage } from "ai";

import {
  deleteConversationForUser,
  getConversationForUser,
  getConversationMessages,
} from "@/lib/server/ai-chat-actions";
import { getCurrentUser } from "@/lib/server/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const conversationId = id?.trim();
  if (!conversationId) {
    return NextResponse.json({ error: "conversation id is required." }, { status: 400 });
  }

  try {
    const conversation = await getConversationForUser(conversationId, user.user_id);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rows = await getConversationMessages(conversationId);
    const messages: UIMessage[] = rows.map((row) => ({
      id: row.message_id,
      role: row.role,
      parts: (Array.isArray(row.parts) ? row.parts : []) as UIMessage["parts"],
    }));

    return NextResponse.json({ data: { conversation, messages } });
  } catch (error) {
    console.error("get AI conversation failed", error);
    return NextResponse.json({ error: "Failed to load conversation." }, { status: 502 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const conversationId = id?.trim();
  if (!conversationId) {
    return NextResponse.json({ error: "conversation id is required." }, { status: 400 });
  }

  try {
    const deleted = await deleteConversationForUser(conversationId, user.user_id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete AI conversation failed", error);
    return NextResponse.json({ error: "Failed to delete conversation." }, { status: 502 });
  }
}
