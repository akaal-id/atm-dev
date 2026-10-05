"use server";

import "server-only";

import { supabaseFetch } from "@/lib/server/supabase-fetch";

import { sendPushToUsers } from "@/lib/server/push";
import { after } from "next/server";
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

  const response = await supabaseFetch(`${url}/rest/v1${path}`, { ...init, cache: "no-store", headers });

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
  if (isChatAdmin(roleId)) {
    // Admins may moderate shared rooms, but a personal notes room stays private to its owner.
    const rooms = await rest<Pick<ChatRoom, "type">[]>(`/chat_rooms?select=type&room_id=eq.${encodeURIComponent(roomId)}&limit=1`);
    if (rooms?.[0]?.type !== "self") return;
  }
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

const SELF_ROOM_NAME = "My notes";

/** The user's personal notes room, created on first use (one per user, enforced by a unique index). */
export async function ensureSelfRoom(): Promise<ChatRoom | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  const find = () =>
    rest<ChatRoom[]>(`/chat_rooms?select=*&type=eq.self&created_by=eq.${encodeURIComponent(me.user_id)}&limit=1`).then((rows) => rows?.[0] ?? null);

  const existing = await find();
  if (existing) return existing;

  const roomId = makeId("room");
  try {
    await rest("/chat_rooms", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ room_id: roomId, name: SELF_ROOM_NAME, type: "self", created_by: me.user_id }),
    });
  } catch {
    // Lost a race with another tab: the unique index kept the first room.
    return find();
  }
  await rest("/room_members", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ member_id: makeId("mbr"), room_id: roomId, user_id: me.user_id, role: "admin" }),
  });
  return find();
}

/** Rooms the user belongs to, shaped for the sidebar. */
export async function listRoomsForUser(): Promise<ChatRoomSummary[]> {
  const me = await getCurrentUser();
  if (!me) return [];

  const memberships = await rest<Array<Pick<RoomMember, "room_id"> & { last_read_at: string | null }>>(
    `/room_members?select=room_id,last_read_at&user_id=eq.${encodeURIComponent(me.user_id)}`,
  );
  const lastRead = new Map(memberships.map((m) => [m.room_id, m.last_read_at]));
  const roomIds = [...new Set(memberships.map((m) => m.room_id))];
  if (roomIds.length === 0) return [];

  const idList = roomIds.map((id) => `"${id}"`).join(",");
  const [rooms, allMembers] = await Promise.all([
    rest<ChatRoom[]>(
      `/chat_rooms?select=*&room_id=in.(${encodeURIComponent(idList)})&order=last_message_at.desc.nullslast`,
    ),
    rest<RoomMember[]>(`/room_members?select=*&room_id=in.(${encodeURIComponent(idList)})`),
  ]);

  type RecentRow = Pick<ChatMessage, "sender_id" | "type" | "content" | "file_name" | "created_at">;
  const [authors, recentByRoom] = await Promise.all([
    authorsByIds(allMembers.map((m) => m.user_id)),
    // Latest messages per room: the first is the preview, the rest count towards unread.
    Promise.all(
      roomIds.map(async (id) => {
        const rows = await rest<RecentRow[]>(
          `/messages?select=sender_id,type,content,file_name,created_at&room_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=21`,
        ).catch(() => [] as RecentRow[]);
        return [id, rows] as const;
      }),
    ).then((entries) => new Map(entries)),
  ]);

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
        room.type === "self"
          ? SELF_ROOM_NAME
          : room.type === "private"
            ? other?.full_name || room.name || "Direct message"
            : room.name || "Group",
      displayAvatar: room.type === "private" ? other?.profile_photo ?? "" : room.avatar_url,
      lastMessagePreview: previewOf(recentByRoom.get(room.room_id)?.[0], me.user_id, authors),
      unreadCount: (() => {
        const since = lastRead.get(room.room_id);
        // Never opened since unread tracking started: treat as read rather than flag history.
        if (!since) return 0;
        return (recentByRoom.get(room.room_id) ?? []).filter((m) => m.sender_id !== me.user_id && m.created_at > since).length;
      })(),
    };
  });
}

/** One-line summary of a message for the room list ("You: …", "📎 file", "📋 Task"). */
function previewOf(
  message: Pick<ChatMessage, "sender_id" | "type" | "content" | "file_name"> | undefined,
  myId: string,
  authors: Map<string, ChatAuthor>,
) {
  if (!message) return "";
  const body =
    message.type === "file"
      ? `📎 ${message.file_name || "File"}`
      : message.type === "task"
        ? "📋 Task"
        : message.content.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (message.type === "system") return body;
  const who = message.sender_id === myId ? "You" : authors.get(message.sender_id)?.full_name.split(" ")[0];
  return who ? `${who}: ${body}` : body;
}

/** Push a new chat message to the room's other members (one notification per room, replaced as messages arrive). */
async function notifyRoomMembers(roomId: string, sender: { user_id: string; full_name: string }, message: ChatMessage) {
  try {
    const [room, members] = await Promise.all([
      rest<ChatRoom[]>(`/chat_rooms?select=room_id,name,type&room_id=eq.${encodeURIComponent(roomId)}`).then((rows) => rows[0]),
      rest<RoomMember[]>(`/room_members?select=user_id&room_id=eq.${encodeURIComponent(roomId)}`),
    ]);
    const recipients = members.map((member) => member.user_id).filter((id) => id !== sender.user_id);
    if (!room || room.type === "self" || !recipients.length) return;
    const body = previewOf(message, "", new Map([[sender.user_id, { user_id: sender.user_id, full_name: sender.full_name, profile_photo: "" }]]));
    await sendPushToUsers(recipients, {
      title: room.type === "group" ? room.name || "Group chat" : sender.full_name,
      // Group pushes keep the "Name: …" prefix; direct messages show just the text.
      body: room.type === "group" ? body : body.replace(/^[^:]+:\s/, ""),
      url: `/chat/${roomId}`,
      tag: `chat-${roomId}`,
    });
  } catch (error) {
    console.error("Chat push failed", error);
  }
}

/** Mark the room as read for the current user (drives the unread badge). */
export async function markRoomRead(roomId: string): Promise<void> {
  const me = await getCurrentUser();
  if (!me) return;
  await rest(`/room_members?room_id=eq.${encodeURIComponent(roomId)}&user_id=eq.${encodeURIComponent(me.user_id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_read_at: new Date().toISOString() }),
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
  const me = await getCurrentUser();
  if (!me) return null;
  const rows = await rest<ChatMessage[]>(`/messages?select=*&message_id=eq.${encodeURIComponent(messageId)}&limit=1`);
  const message = rows?.[0];
  if (!message) return null;
  await requireMembership(message.room_id, me.user_id, me.role_id);
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
    link_preview: null,
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

  // After the response: the sender never waits on link previews or push delivery. The preview is
  // patched onto the row and reaches every open chat through the realtime UPDATE event.
  // (No revalidatePath: the sender already shows the message, and re-rendering the whole room
  // page inside the action response was the main source of send lag.)
  after(async () => {
    await notifyRoomMembers(input.room_id, me, message);
    const url = type === "text" && message.content ? firstUrl(message.content) : null;
    const preview = url ? await fetchLinkPreview(url).catch(() => null) : null;
    if (preview) {
      await rest(`/messages?message_id=eq.${encodeURIComponent(message.message_id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ link_preview: preview }),
      }).catch(() => null);
    }
  });
  return {
    ...message,
    author: authors.get(message.sender_id) ?? null,
    task: message.task_id ? tasks.get(message.task_id) ?? null : null,
  };
}

export async function createRoom(input: CreateRoomInput): Promise<ChatRoom> {
  const me = await getCurrentUser();
  if (!me) throw new Error("Unauthorized");

  if (input.type !== "private" && input.type !== "group") throw new Error("Invalid room type.");
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
  if (room?.[0]?.type === "self") {
    throw new Error("Personal notes cannot be shared.");
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
