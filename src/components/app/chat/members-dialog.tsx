"use client";

import { Search, UserMinus, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { addMember, removeMember } from "@/lib/server/chat-actions";
import type { ChatAuthor, RoomMember } from "@/lib/types/chat";

export interface DirectoryUser {
  user_id: string;
  full_name: string;
  profile_photo: string;
}

type MemberRow = RoomMember & { author: ChatAuthor | null };

/** Group management — view members, add existing users, remove members. */
export function MembersDialog({
  open,
  onClose,
  roomId,
  members,
  directory,
  canManage,
  canRemoveOthers,
  currentUserId,
  roomType,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  members: MemberRow[];
  directory: DirectoryUser[];
  canManage: boolean;
  canRemoveOthers: boolean;
  currentUserId: string;
  roomType: "private" | "group";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [localMembers, setLocalMembers] = useState(members);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setLocalMembers(members);
      setQuery("");
      setError("");
    }
  }, [open, members]);

  const memberIds = useMemo(() => new Set(localMembers.map((m) => m.user_id)), [localMembers]);

  const addable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directory
      .filter((u) => !memberIds.has(u.user_id))
      .filter((u) => !q || u.full_name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [directory, memberIds, query]);

  function handleAdd(user: DirectoryUser) {
    setError("");
    startTransition(async () => {
      try {
        await addMember(roomId, user.user_id);
        setLocalMembers((prev) => [
          ...prev,
          {
            member_id: `tmp_${user.user_id}`,
            room_id: roomId,
            user_id: user.user_id,
            role: "member",
            joined_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            author: { user_id: user.user_id, full_name: user.full_name, profile_photo: user.profile_photo },
          },
        ]);
        setQuery("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add member.");
      }
    });
  }

  function handleRemove(userId: string) {
    setError("");
    const leaving = userId === currentUserId;
    startTransition(async () => {
      try {
        await removeMember(roomId, userId);
        if (leaving) {
          onClose();
          router.push("/chat");
          router.refresh();
          return;
        }
        setLocalMembers((prev) => prev.filter((m) => m.user_id !== userId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove member.");
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-neutral-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-6">
      <div className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[2px] bg-card shadow-2xl sm:max-w-md sm:rounded-[2px]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-normal text-foreground">
            {roomType === "private" ? "Participants" : "Members"} · {localMembers.length}
          </h2>
          <button type="button" onClick={onClose} className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y divide-border">
            {localMembers.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={m.author?.full_name ?? m.user_id} image={m.author?.profile_photo} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-normal text-foreground">{m.author?.full_name ?? m.user_id}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">{m.role}</p>
                </div>
                {(canRemoveOthers && m.user_id !== currentUserId) || m.user_id === currentUserId ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.user_id)}
                    disabled={pending}
                    className="ml-auto grid h-8 w-8 place-items-center rounded-[2px] text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label={m.user_id === currentUserId ? "Leave chat" : `Remove ${m.author?.full_name ?? m.user_id}`}
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {canManage && roomType === "group" ? (
            <div className="border-t border-border p-3">
              <p className="mb-2 px-1 text-xs font-normal uppercase tracking-wide text-muted-foreground">Add member</p>
              <div className="mb-2 flex items-center gap-2 rounded-[2px] border border-border px-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people…"
                  className="h-9 w-full bg-transparent text-sm outline-none"
                />
              </div>
              <ul>
                {addable.map((u) => (
                  <li key={u.user_id}>
                    <button
                      type="button"
                      onClick={() => handleAdd(u)}
                      disabled={pending}
                      className="flex w-full items-center gap-3 rounded-[2px] px-2 py-2 text-left transition hover:bg-surface-inset disabled:opacity-50"
                    >
                      <Avatar name={u.full_name} image={u.profile_photo} size="sm" />
                      <span className="truncate text-sm text-foreground">{u.full_name}</span>
                      <UserPlus className="ml-auto h-4 w-4 text-primary" />
                    </button>
                  </li>
                ))}
                {addable.length === 0 ? <li className="px-2 py-3 text-center text-xs text-muted-foreground">No more users to add.</li> : null}
              </ul>
            </div>
          ) : roomType === "private" ? (
            <p className="border-t border-border p-4 text-center text-xs text-muted-foreground">
              To chat with more people, start a group from Messages → New chat.
            </p>
          ) : null}

          {error ? <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
