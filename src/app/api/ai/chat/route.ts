import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { NextResponse, type NextRequest } from "next/server";

import { maybeRefreshMemory } from "@/lib/server/ai/modules/memory";
import { hasAudioPart, messagesForModel, persistableParts, textFromParts } from "@/lib/server/ai/parts";
import { createAiRegistry } from "@/lib/server/ai/registry";
import {
  CONTEXT_WINDOW,
  getConversationForUser,
  getConversationMessages,
  getUserMemory,
  takeContextWindow,
  titleFromUserText,
  updateConversationTitle,
  upsertMessage,
} from "@/lib/server/ai-chat-actions";
import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import { makeId } from "@/lib/utils";

/**
 * POST /api/ai/chat
 * Streams a chat reply from the configured LLM. Auth-gated — no anonymous access.
 * Persists messages to the given conversation. Prompt/tools come from the AI registry.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    messages?: UIMessage[];
    conversationId?: string;
    pagePath?: string;
  };

  const conversationId = String(body.conversationId ?? "").trim();
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required." }, { status: 400 });
  }

  const conversation = await getConversationForUser(conversationId, user.user_id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const windowed = takeContextWindow(incoming, CONTEXT_WINDOW);
  const lastUser = [...windowed].reverse().find((message) => message.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "User message is required." }, { status: 400 });
  }

  const priorCount = (await getConversationMessages(conversationId)).length;
  await upsertMessage({
    messageId: lastUser.id || makeId("aim"),
    conversationId,
    role: "user",
    parts: persistableParts(lastUser.parts),
  });

  if (priorCount === 0 || conversation.title === "Chat baru") {
    const spoken = textFromParts(lastUser.parts);
    const title = spoken
      ? titleFromUserText(spoken)
      : hasAudioPart(lastUser.parts)
        ? "Pesan suara"
        : "Chat baru";
    if (title !== "Chat baru") {
      await updateConversationTitle(conversationId, title).catch(() => undefined);
    }
  }

  const [context, memory] = await Promise.all([
    getActiveCompanyContext(user.user_id),
    getUserMemory(user.user_id),
  ]);

  let memoryTouched = false;
  const { system, tools } = createAiRegistry(
    {
      user,
      companyId: context.company.id,
      companyName: context.company.name,
      pagePath: body.pagePath,
      onRememberFact: () => {
        memoryTouched = true;
      },
    },
    { memorySummary: memory?.summary ?? "", memoryFacts: memory?.facts ?? [] },
  );

  const result = streamText({
    model: google("gemini-3.5-flash-lite"),
    system,
    messages: await convertToModelMessages(messagesForModel(windowed)),
    stopWhen: stepCountIs(4),
    tools,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: windowed,
    generateMessageId: () => makeId("aim"),
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted || !responseMessage) return;
      try {
        await upsertMessage({
          messageId: responseMessage.id || makeId("aim"),
          conversationId,
          role: "assistant",
          parts: responseMessage.parts ?? [],
        });
        await maybeRefreshMemory({
          userId: user.user_id,
          conversationId,
          force: memoryTouched,
        });
      } catch (error) {
        console.error("persist AI assistant message failed", error);
      }
    },
  });
}
