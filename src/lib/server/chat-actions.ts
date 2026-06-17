"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/server/auth";
import { hasAnyPermission } from "@/lib/permissions";
import type { RoleKey } from "@/lib/types";
import type {
  ChatAuthor,
  ChatMessage,
  ChatMessageView,
  ChatRoom,
  ChatRoomSummary,
  ChatTaskCard,
  CreateRoomInput,
  LinkPreview,
  RoomMember,
  SendMessageInput,
} from "@/lib/types/chat";
import { makeId } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Supabase REST helper (mirrors src/lib/server/supabase-store.ts — uses the
// secret key, which bypasses RLS. This is the authoritative security boundary.)
// ---------------------------------------------------------------------------

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

  const response = await fetch(`${url}/rest/v1${path}`, { ...init, cache: "no-store", headers });

  if (!response.ok) {
    const preview = (await response.text()).slice(0, 500);
    throw new Error(`Supabase request failed (${response.status}) for ${path}: ${preview}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

function isChatAdmin(roleId: string) {
  return hasAnyPermission(roleId as RoleKey, ["admin:view"]);
}

async function requireMembership(roomId: string, userId: string, roleId: string) {
  if (isChatAdmin(roleId)) return;
  const rows = await rest<RoomMember[]>(
    `/room_members?select=member_id&room_id=eq.${encodeURIComponent(roomId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!rows?.length) throw new Error("Forbidden: you are not a member of this room.");
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function authorsByIds(ids: string[]): Promise<Map<string, ChatAuthor>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const list = unique.map((id) => `"${id}"`).join(",");
  const rows = await rest<ChatAuthor[]>(
    `/users?select=user_id,full_name,profile_photo&user_id=in.(${encodeURIComponent(list)})`,
  );
  return new Map(rows.map((row) => [row.user_id, row]));
}

/** Rooms the user belongs to, shaped for the sidebar. */
export async function listRoomsForUser(): Promise<ChatRoomSummary[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const memberships = await rest<RoomMember[]>(
    `/room_members?select=room_id&user_id=eq.${encodeURIComponent(me.user_id)}`,
  );
  const roomIds = [...new Set(memberships.map((m) => m.room_id))];
  if (roomIds.length === 0) return [];

  const idList = roomIds.map((id) => `"${id}"`).join(",");
  const [rooms, allMembers] = await Promise.all([
    rest<ChatRoom[]>(
      `/chat_rooms?select=*&room_id=in.(${encodeURIComponent(idList)})&order=last_message_at.desc.nullslast`,
    ),
    rest<RoomMember[]>(`/room_members?select=*&room_id=in.(${encodeURIComponent(idList)})`),
  ]);

  const authors = await authorsByIds(allMembers.map((m) => m.user_id));

  return rooms.map((room) => {
    const members = allMembers
      .filter((m) => m.room_id === room.room_id)
      .map((m) => authors.get(m.user_id))
      .filter((a): a is ChatAuthor => Boolean(a));

    const other = room.type === "private" ? members.find((m) => m.user_id !== me.user_id) : undefined;

    return {
      ...room,
      members,
      memberCount: members.length,
      displayName:
        room.type === "private" ? other?.full_name || room.name || "Direct message" : room.name || "Group",
      displayAvatar: room.type === "private" ? other?.profile_photo ?? "" : room.avatar_url,
      lastMessagePreview: "",
    };
  });
}

/** Active users (excluding the current user) for new-chat / add-member pickers. */
export async function listDirectory(): Promise<ChatAuthor[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const rows = await rest<(ChatAuthor & { is_active: boolean })[]>(
    `/users?select=user_id,full_name,profile_photo,is_active&is_active=eq.true&order=full_name.asc`,
  );
  return rows
    .filter((u) => u.user_id !== me.user_id)
    .map((u) => ({ user_id: u.user_id, full_name: u.full_name, profile_photo: u.profile_photo }));
}

export async function getRoom(roomId: string): Promise<ChatRoom | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  await requireMembership(roomId, me.user_id, me.role_id);
  const rows = await rest<ChatRoom[]>(`/chat_rooms?select=*&room_id=eq.${encodeURIComponent(roomId)}&limit=1`);
  return rows?.[0] ?? null;
}

export async function listMembers(roomId: string): Promise<(RoomMember & { author: ChatAuthor | null })[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  await requireMembership(roomId, me.user_id, me.role_id);
  const members = await rest<RoomMember[]>(
    `/room_members?select=*&room_id=eq.${encodeURIComponent(roomId)}&order=role.asc`,
  );
  const authors = await authorsByIds(members.map((m) => m.user_id));
  return members.map((m) => ({ ...m, author: authors.get(m.user_id) ?? null }));
}

/** Full message history for a room, joined with authors + task cards. */
export async function listMessages(roomId: string, limit = 100): Promise<ChatMessageView[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  await requireMembership(roomId, me.user_id, me.role_id);

  const messages = await rest<ChatMessage[]>(
    `/messages?select=*&room_id=eq.${encodeURIComponent(roomId)}&order=created_at.asc&limit=${limit}`,
  );

  const authors = await authorsByIds(messages.map((m) => m.sender_id));
  const taskIds = [...new Set(messages.map((m) => m.task_id).filter((id): id is string => Boolean(id)))];
  const tasks = await tasksByIds(taskIds);

  return messages.map((m) => ({
    ...m,
    author: authors.get(m.sender_id) ?? null,
    task: m.task_id ? tasks.get(m.task_id) ?? null : null,
  }));
}

async function tasksByIds(ids: string[]): Promise<Map<string, ChatTaskCard>> {
  if (ids.length === 0) return new Map();
  const list = ids.map((id) => `"${id}"`).join(",");
  const rows = await rest<ChatTaskCard[]>(
    `/tasks?select=task_id,title,description,status,project_id&task_id=in.(${encodeURIComponent(list)})`,
  );
  return new Map(rows.map((row) => [row.task_id, row]));
}

/** Hydrate a single message (used when a realtime payload arrives). */
export async function hydrateMessage(messageId: string): Promise<ChatMessageView | null> {
  const rows = await rest<ChatMessage[]>(`/messages?select=*&message_id=eq.${encodeURIComponent(messageId)}&limit=1`);
  const message = rows?.[0];
  if (!message) return null;
  const [authors, tasks] = await Promise.all([
    authorsByIds([message.sender_id]),
    message.task_id ? tasksByIds([message.task_id]) : Promise.resolve(new Map<string, ChatTaskCard>()),
  ]);
  return {
    ...message,
    author: authors.get(message.sender_id) ?? null,
    task: message.task_id ? tasks.get(message.task_id) ?? null : null,
  };
}

// ---------------------------------------------------------------------------
// Link preview scraper (React 19 Server Action)
// ---------------------------------------------------------------------------

function metaContent(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return "";
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function ogTag(prop: string) {
  return [
    new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']twitter:${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
  ];
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; AkaalBot/1.0; +link-preview)" },
      // Cache previews for an hour to keep the free tier happy.
      next: { revalidate: 3600 },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = (await response.text()).slice(0, 250_000);

    const title =
      metaContent(html, ogTag("title")) ||
      metaContent(html, [/<title[^>]*>([^<]*)<\/title>/i]) ||
      parsed.hostname;
    const description = metaContent(html, [
      ...ogTag("description"),
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    ]);
    let image = metaContent(html, ogTag("image"));
    if (image && image.startsWith("/")) image = `${parsed.origin}${image}`;
    const siteName = metaContent(html, ogTag("site_name")) || parsed.hostname;

    return { url: parsed.toString(), title, description, image, siteName };
  } catch {
    return null;
  }
}

const URL_REGEX = /https?:\/\/[^\s<>"')]+/i;

function firstUrl(htmlOrText: string): string | null {
  // strip tags so we don't match href attributes of our own anchors twice
  const text = htmlOrText.replace(/<[^>]+>/g, " ");
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

// ---------------------------------------------------------------------------
// Mutators
// ---------------------------------------------------------------------------

export async function sendMessage(input: SendMessageInput): Promise<ChatMessageView> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Unauthorized");
  await requireMembership(input.room_id, me.user_id, me.role_id);

  const type = input.type ?? "text";

  // Scrape a link preview for plain text messages that contain a URL.
  let linkPreview: LinkPreview | null = null;
  if (type === "text" && input.content) {
    const url = firstUrl(input.content);
    if (url) linkPreview = await fetchLinkPreview(url);
  }

  const record = {
    message_id: input.message_id || makeId("msg"),
    room_id: input.room_id,
    sender_id: me.user_id,
    type,
    content: sanitizeHtml(input.content ?? ""),
    file_url: input.file_url ?? null,
    file_name: input.file_name ?? null,
    file_mime: input.file_mime ?? null,
    task_id: input.task_id ?? null,
    link_preview: linkPreview,
    reply_to: input.reply_to ?? null,
  };

  const rows = await rest<ChatMessage[]>("/messages", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  const message = rows[0];

  const [authors, tasks] = await Promise.all([
    authorsByIds([message.sender_id]),
    message.task_id ? tasksByIds([message.task_id]) : Promise.resolve(new Map<string, ChatTaskCard>()),
  ]);

  revalidatePath(`/chat/${input.room_id}`);
  return {
    ...message,
    author: authors.get(message.sender_id) ?? null,
    task: message.task_id ? tasks.get(message.task_id) ?? null : null,
  };
}

export async function createRoom(input: CreateRoomInput): Promise<ChatRoom> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Unauthorized");

  const memberIds = [...new Set([me.user_id, ...input.member_ids])];

  // Reuse an existing private room between exactly these two users.
  if (input.type === "private" && memberIds.length === 2) {
    const existing = await findPrivateRoom(memberIds[0], memberIds[1]);
    if (existing) return existing;
  }

  const roomId = makeId("room");
  const rooms = await rest<ChatRoom[]>("/chat_rooms", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      room_id: roomId,
      name: input.name ?? "",
      type: input.type,
      created_by: me.user_id,
    }),
  });

  const memberRows = memberIds.map((userId) => ({
    member_id: makeId("mbr"),
    room_id: roomId,
    user_id: userId,
    role: userId === me.user_id ? "admin" : "member",
  }));
  await rest("/room_members", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(memberRows),
  });

  revalidatePath("/chat");
  return rooms[0];
}

async function findPrivateRoom(a: string, b: string): Promise<ChatRoom | null> {
  const aRooms = await rest<RoomMember[]>(
    `/room_members?select=room_id&user_id=eq.${encodeURIComponent(a)}`,
  );
  const roomIds = aRooms.map((r) => r.room_id);
  if (roomIds.length === 0) return null;
  const idList = roomIds.map((id) => `"${id}"`).join(",");
  const bMembership = await rest<RoomMember[]>(
    `/room_members?select=room_id&user_id=eq.${encodeURIComponent(b)}&room_id=in.(${encodeURIComponent(idList)})`,
  );
  const shared = bMembership.map((r) => r.room_id);
  if (shared.length === 0) return null;
  const sharedList = shared.map((id) => `"${id}"`).join(",");
  const rooms = await rest<ChatRoom[]>(
    `/chat_rooms?select=*&type=eq.private&room_id=in.(${encodeURIComponent(sharedList)})&limit=1`,
  );
  return rooms?.[0] ?? null;
}

export async function addMember(roomId: string, userId: string): Promise<void> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Unauthorized");
  await requireMembership(roomId, me.user_id, me.role_id);

  const room = await rest<ChatRoom[]>(`/chat_rooms?select=type&room_id=eq.${encodeURIComponent(roomId)}&limit=1`);
  if (room?.[0]?.type === "private") {
    throw new Error("Cannot add members to a direct message. Start a group chat instead.");
  }

  const existing = await rest<RoomMember[]>(
    `/room_members?select=member_id&room_id=eq.${encodeURIComponent(roomId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (existing?.length) return;

  await rest("/room_members", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ member_id: makeId("mbr"), room_id: roomId, user_id: userId, role: "member" }),
  });
  revalidatePath(`/chat/${roomId}`);
}

export async function removeMember(roomId: string, userId: string): Promise<void> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Unauthorized");
  await requireMembership(roomId, me.user_id, me.role_id);

  const isSelf = userId === me.user_id;
  if (!isSelf) {
    await requireRoomAdmin(roomId, me.user_id, me.role_id);
  }

  await rest(
    `/room_members?room_id=eq.${encodeURIComponent(roomId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  revalidatePath(`/chat/${roomId}`);
  if (isSelf) revalidatePath("/chat");
}

async function requireRoomAdmin(roomId: string, userId: string, roleId: string) {
  if (isChatAdmin(roleId)) return;
  const rows = await rest<RoomMember[]>(
    `/room_members?select=role&room_id=eq.${encodeURIComponent(roomId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (rows?.[0]?.role !== "admin") throw new Error("Forbidden: room admin required.");
}

// ---------------------------------------------------------------------------
// Minimal HTML sanitizer for TipTap output.
// Strips <script>/<style>, event handlers, and javascript: URLs. For a hardened
// deployment swap this for `isomorphic-dompurify`.
// ---------------------------------------------------------------------------

function sanitizeHtml(html: string): string {
  return html
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '$1="#"');
}
