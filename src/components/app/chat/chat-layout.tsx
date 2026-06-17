"use client";

import { MessageSquarePlus, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { DirectoryUser } from "@/components/app/chat/members-dialog";
import { Avatar } from "@/components/ui/avatar";
import { createRoom } from "@/lib/server/chat-actions";
import type { ChatRoomSummary } from "@/lib/types/chat";
import { cn } from "@/lib/utils";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export function ChatLayout({
  rooms,
  directory,
  activeRoomId,
  children,
}: {
  rooms: ChatRoomSummary[];
  directory: DirectoryUser[];
  activeRoomId?: string;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [rooms, query]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 overflow-hidden bg-white",
        activeRoomId
          ? "h-full"
          : "h-full md:rounded-xl md:border md:border-slate-200 md:h-[calc(100dvh-7rem)]",
      )}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          "w-full shrink-0 flex-col border-r border-slate-200 md:flex md:w-80",
          activeRoomId ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h1 className="text-base font-semibold text-slate-900">Messages</h1>
          <button
            type="button"
            onClick={() => setNewChatOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-blue-600 transition hover:bg-blue-50"
            aria-label="New chat"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 p-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              className="h-9 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No conversations yet.</p>
          ) : (
            filtered.map((room) => (
              <Link
                key={room.room_id}
                href={`/chat/${room.room_id}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50",
                  activeRoomId === room.room_id && "bg-blue-50",
                )}
              >
                {room.type === "group" && !room.displayAvatar ? (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                    <Users className="h-5 w-5" />
                  </span>
                ) : (
                  <Avatar name={room.displayName} image={room.displayAvatar} size="md" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">{room.displayName}</p>
                    <span className="ml-auto shrink-0 text-[10px] text-slate-400">{timeAgo(room.last_message_at)}</span>
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {room.type === "group" ? `${room.memberCount} members` : "Direct message"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </nav>
      </aside>

      {/* Main window */}
      <main className={cn("flex min-h-0 min-w-0 flex-1 flex-col", activeRoomId ? "flex h-full" : "hidden md:flex")}>
        <div className="flex h-full min-h-0 w-full flex-1 flex-col">{children}</div>
      </main>

      <NewChatDialog open={newChatOpen} onClose={() => setNewChatOpen(false)} directory={directory} />
    </div>
  );
}

function NewChatDialog({ open, onClose, directory }: { open: boolean; onClose: () => void; directory: DirectoryUser[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directory.filter((u) => !q || u.full_name.toLowerCase().includes(q)).slice(0, 50);
  }, [directory, query]);

  const isGroup = selected.size > 1;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function start() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const room = await createRoom({
        type: isGroup ? "group" : "private",
        name: isGroup ? groupName.trim() || "New group" : "",
        member_ids: [...selected],
      });
      onClose();
      setSelected(new Set());
      setQuery("");
      setGroupName("");
      router.push(`/chat/${room.room_id}`);
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
      <div className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:max-w-md sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">New conversation</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isGroup ? (
          <div className="border-b border-slate-100 p-3">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
        ) : null}

        <div className="border-b border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              className="h-9 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.map((u) => (
            <button
              key={u.user_id}
              type="button"
              onClick={() => toggle(u.user_id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50",
                selected.has(u.user_id) && "bg-blue-50",
              )}
            >
              <Avatar name={u.full_name} image={u.profile_photo} size="sm" />
              <span className="truncate text-sm text-slate-900">{u.full_name}</span>
              <span
                className={cn(
                  "ml-auto grid h-5 w-5 place-items-center rounded-full border",
                  selected.has(u.user_id) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300",
                )}
              >
                {selected.has(u.user_id) ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={start}
            disabled={selected.size === 0 || pending}
            className="h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Creating…" : isGroup ? `Create group (${selected.size})` : "Start chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
