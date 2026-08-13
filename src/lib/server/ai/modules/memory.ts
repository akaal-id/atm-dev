import { google } from "@ai-sdk/google";
import { generateText, tool, type UIMessage } from "ai";
import { z } from "zod";

import {
  countUserMessages,
  getConversationMessages,
  getUserMemory,
  rememberUserFact,
  takeContextWindow,
  upsertUserMemory,
} from "@/lib/server/ai-chat-actions";
import type { AiToolContext } from "@/lib/server/ai/context";
import { textFromParts } from "@/lib/server/ai/parts";
import type { AiMemoryFact } from "@/lib/types/ai-chat";

export function memoryRules(input: { memorySummary: string; memoryFacts: AiMemoryFact[] }) {
  const memorySummary = input.memorySummary.trim() || "(belum ada ringkasan memory)";
  const facts = input.memoryFacts.length
    ? input.memoryFacts.map((fact) => `- ${fact.key}: ${fact.value}`).join("\n")
    : "(belum ada fakta tersimpan)";

  return `Memory pengguna (lintas chat, tersimpan dari percakapan sebelumnya — PAKAI ini secara aktif kalau relevan,
misalnya untuk menyapa sesuai preferensi, mengingat gaya kerja, atau konteks berulang. Jangan mengarang di luar
data ini. Update lewat tool rememberFact kalau user minta diingat sesuatu yang baru):
Ringkasan: ${memorySummary}
Fakta:
${facts}`;
}

export function memoryTools(ctx: AiToolContext) {
  return {
    rememberFact: tool({
      description:
        "Simpan fakta stabil tentang user (preferensi, nama panggilan, gaya kerja). Pakai saat user minta diingat.",
      inputSchema: z.object({
        key: z.string().min(1).max(80),
        value: z.string().min(1).max(400),
      }),
      execute: async ({ key, value }) => {
        ctx.onRememberFact?.();
        const saved = await rememberUserFact(ctx.user.user_id, key, value);
        return { ok: true, key, value, factCount: saved.facts.length };
      },
    }),
  };
}

export async function maybeRefreshMemory(input: {
  userId: string;
  conversationId: string;
  force?: boolean;
}) {
  try {
    const userCount = await countUserMessages(input.conversationId);
    if (!input.force && userCount !== 1 && userCount % 3 !== 0) return;

    const existing = await getUserMemory(input.userId);
    const recent = takeContextWindow(await getConversationMessages(input.conversationId), 16);
    const transcript = recent
      .map((row) => {
        const text = textFromParts(row.parts as UIMessage["parts"]);
        return text ? `${row.role}: ${text}` : null;
      })
      .filter(Boolean)
      .join("\n");

    if (!transcript.trim()) return;

    const { text } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      prompt: `Perbarui ringkasan memory pengguna ERP berdasarkan chat berikut.
Simpan hanya fakta stabil (preferensi, nama panggilan, gaya kerja, konteks berulang).
Jangan simpan data sensitif (password, token, rahasia).
Balas HANYA JSON valid: {"summary":"...","facts":[{"key":"...","value":"..."}]}

Memory lama:
summary: ${existing?.summary ?? ""}
facts: ${JSON.stringify(existing?.facts ?? [])}

Chat terbaru:
${transcript}`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const parsed = JSON.parse(jsonMatch[0]) as {
      summary?: string;
      facts?: Array<{ key?: string; value?: string }>;
    };

    const facts: AiMemoryFact[] = Array.isArray(parsed.facts)
      ? parsed.facts
          .map((fact) => {
            const key = String(fact?.key ?? "").trim();
            const value = String(fact?.value ?? "").trim();
            if (!key || !value) return null;
            return { key, value, updated_at: new Date().toISOString() } satisfies AiMemoryFact;
          })
          .filter((fact): fact is AiMemoryFact => Boolean(fact))
      : (existing?.facts ?? []);

    await upsertUserMemory({
      userId: input.userId,
      summary: String(parsed.summary ?? existing?.summary ?? "").trim().slice(0, 1200),
      facts: facts.slice(-40),
    });
  } catch (error) {
    console.error("AI memory refresh failed", error);
  }
}
