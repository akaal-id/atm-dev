import "server-only";

import type {
  AiConversation,
  AiConversationSummary,
  AiMemoryFact,
  AiMessageRole,
  AiMessageRow,
  AiUserMemory,
} from "@/lib/types/ai-chat";
import { makeId } from "@/lib/utils";

const CONTEXT_WINDOW = 30;

function supabaseUrl() {
  const explicit = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const projectId = process.env.SUPABASE_PROJECT_ID;
  return projectId ? `https://${projectId}.supabase.co` : "";
}

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  if (!headers.has("Prefer") && (init.method === "POST" || init.method === "PATCH")) {
    headers.set("Prefer", "return=representation");
  }

  const response = await fetch(`${url}/rest/v1${path}`, { ...init, cache: "no-store", headers });

  if (!response.ok) {
    const preview = (await response.text()).slice(0, 500);
    throw new Error(`Supabase request failed (${response.status}) for ${path}: ${preview}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function parseFacts(raw: unknown): AiMemoryFact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const key = String(row.key ?? "").trim();
      const value = String(row.value ?? "").trim();
      if (!key || !value) return null;
      return {
        key,
        value,
        updated_at: String(row.updated_at ?? new Date().toISOString()),
      } satisfies AiMemoryFact;
    })
    .filter((fact): fact is AiMemoryFact => Boolean(fact));
}

function normalizeMemory(row: AiUserMemory | undefined): AiUserMemory | null {
  if (!row) return null;
  return {
    user_id: row.user_id,
    summary: row.summary ?? "",
    facts: parseFacts(row.facts),
    updated_at: row.updated_at,
  };
}

export async function listConversationsForUser(userId: string): Promise<AiConversationSummary[]> {
  const rows = await rest<AiConversation[]>(
    `/ai_conversations?user_id=eq.${encodeURIComponent(userId)}&select=conversation_id,title,last_message_at,created_at,updated_at,company_id&order=last_message_at.desc.nullslast,created_at.desc`,
  );
  return rows ?? [];
}

export async function createConversation(userId: string, companyId: string): Promise<AiConversation> {
  const conversation: AiConversation = {
    conversation_id: makeId("aic"),
    user_id: userId,
    company_id: companyId,
    title: "Chat baru",
    last_message_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const rows = await rest<AiConversation[]>("/ai_conversations", {
    method: "POST",
    body: JSON.stringify(conversation),
  });
  return rows[0] ?? conversation;
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
): Promise<AiConversation | null> {
  const rows = await rest<AiConversation[]>(
    `/ai_conversations?conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function deleteConversationForUser(conversationId: string, userId: string): Promise<boolean> {
  const existing = await getConversationForUser(conversationId, userId);
  if (!existing) return false;
  await rest(`/ai_conversations?conversation_id=eq.${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
  });
  return true;
}

export async function getConversationMessages(
  conversationId: string,
  options?: { limit?: number },
): Promise<AiMessageRow[]> {
  const limit = options?.limit ?? 200;
  const rows = await rest<AiMessageRow[]>(
    `/ai_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.asc&limit=${limit}`,
  );
  return rows ?? [];
}

export async function countUserMessages(conversationId: string): Promise<number> {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return 0;

  const response = await fetch(
    `${url}/rest/v1/ai_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&role=eq.user&select=message_id`,
    {
      cache: "no-store",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  if (!response.ok) return 0;
  const range = response.headers.get("content-range");
  if (!range) return 0;
  const total = range.split("/")[1];
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

export async function upsertMessage(input: {
  messageId: string;
  conversationId: string;
  role: AiMessageRole;
  parts: unknown[];
  createdAt?: string;
}): Promise<AiMessageRow> {
  const row: AiMessageRow = {
    message_id: input.messageId,
    conversation_id: input.conversationId,
    role: input.role,
    parts: input.parts,
    created_at: input.createdAt ?? new Date().toISOString(),
  };

  const rows = await rest<AiMessageRow[]>("/ai_messages", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  return rows?.[0] ?? row;
}

export async function updateConversationTitle(
  conversationId: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim().slice(0, 60) || "Chat baru";
  await rest(`/ai_conversations?conversation_id=eq.${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    body: JSON.stringify({ title: trimmed, updated_at: new Date().toISOString() }),
  });
}

export async function getUserMemory(userId: string): Promise<AiUserMemory | null> {
  const rows = await rest<AiUserMemory[]>(
    `/ai_user_memory?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
  );
  return normalizeMemory(rows?.[0]);
}

export async function upsertUserMemory(input: {
  userId: string;
  summary: string;
  facts: AiMemoryFact[];
}): Promise<AiUserMemory> {
  const row: AiUserMemory = {
    user_id: input.userId,
    summary: input.summary.trim(),
    facts: input.facts,
    updated_at: new Date().toISOString(),
  };

  const rows = await rest<AiUserMemory[]>("/ai_user_memory", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  return normalizeMemory(rows?.[0]) ?? row;
}

export async function rememberUserFact(
  userId: string,
  key: string,
  value: string,
): Promise<AiUserMemory> {
  const existing = (await getUserMemory(userId)) ?? {
    user_id: userId,
    summary: "",
    facts: [],
    updated_at: new Date().toISOString(),
  };

  const nextKey = key.trim().slice(0, 80);
  const nextValue = value.trim().slice(0, 400);
  if (!nextKey || !nextValue) return existing;

  const facts = existing.facts.filter((fact) => fact.key.toLowerCase() !== nextKey.toLowerCase());
  facts.push({
    key: nextKey,
    value: nextValue,
    updated_at: new Date().toISOString(),
  });

  const summaryHint = existing.summary.trim();
  const summary =
    summaryHint ||
    `Preferensi pengguna: ${facts.map((fact) => `${fact.key}=${fact.value}`).join("; ")}`;

  return upsertUserMemory({
    userId,
    summary,
    facts: facts.slice(-40),
  });
}

export function titleFromUserText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Chat baru";
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}…` : cleaned;
}

export function takeContextWindow<T>(messages: T[], limit = CONTEXT_WINDOW): T[] {
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
}

export { CONTEXT_WINDOW };
