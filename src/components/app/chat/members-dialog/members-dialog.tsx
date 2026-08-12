"use client";

import styles from "./members-dialog.module.css";

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
    <div className={styles.filterBar}>
      <div className={styles.listBody}>
        <div className={styles.filterbarPrimary}>
          <h2 className={styles.heading}>
            {roomType === "private" ? "Participants" : "Members"} · {localMembers.length}
          </h2>
          <button type="button" onClick={onClose} className={styles.button} aria-label="Close">
            <X className={styles.close} />
          </button>
        </div>

        <div className={styles.closeAlt}>
          <ul className="divide-y divide-border">
            {localMembers.map((m) => (
              <li key={m.user_id} className={styles.item}>
                <Avatar name={m.author?.full_name ?? m.user_id} image={m.author?.profile_photo} size="sm" />
                <div className={styles.content}>
                  <p className={styles.itemMeta}>{m.author?.full_name ?? m.user_id}</p>
                  <p className={styles.text}>{m.role}</p>
                </div>
                {(canRemoveOthers && m.user_id !== currentUserId) || m.user_id === currentUserId ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.user_id)}
                    disabled={pending}
                    className={styles.control}
                    aria-label={m.user_id === currentUserId ? "Leave chat" : `Remove ${m.author?.full_name ?? m.user_id}`}
                  >
                    <UserMinus className={styles.close} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {canManage && roomType === "group" ? (
            <div className={styles.icon}>
              <p className={styles.textP}>Add member</p>
              <div className={styles.glyph}>
                <Search className={styles.iconSearch} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people…"
                  className={styles.input}
                />
              </div>
              <ul>
                {addable.map((u) => (
                  <li key={u.user_id}>
                    <button
                      type="button"
                      onClick={() => handleAdd(u)}
                      disabled={pending}
                      className={styles.rowButton}
                    >
                      <Avatar name={u.full_name} image={u.profile_photo} size="sm" />
                      <span className={styles.ellipsis}>{u.full_name}</span>
                      <UserPlus className={styles.iconUserplus} />
                    </button>
                  </li>
                ))}
                {addable.length === 0 ? <li className={styles.block}>No more users to add.</li> : null}
              </ul>
            </div>
          ) : roomType === "private" ? (
            <p className={styles.errortext}>
              To chat with more people, start a group from Messages → New chat.
            </p>
          ) : null}

          {error ? <p className={styles.textPrimary}>{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
