"use client";

import styles from "./chat-layout.module.css";

import { MessageSquarePlus, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useTenant } from "@/components/app/tenant-provider";
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
  const { href: tenantHref } = useTenant();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [rooms, query]);

  return (
    <div
      className={cn(
        styles.shell,
        activeRoomId
          ? styles.shellRoomOpen
          : styles.shellListOnly,
      )}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          styles.sidebar,
          activeRoomId ? "hidden md:flex" : styles.sidebarExpanded,
        )}
      >
        <div className={styles.sectionHeader}>
          <h1 className={styles.sidebarTitle}>Messages</h1>
          <button
            type="button"
            onClick={() => setNewChatOpen(true)}
            className={styles.iconButton}
            aria-label="New chat"
          >
            <MessageSquarePlus className={styles.iconSm} />
          </button>
        </div>

        <div className={styles.searchBar}>
          <div className={styles.searchField}>
            <Search className={styles.searchIcon} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              className={styles.searchInput}
            />
          </div>
        </div>

        <nav className={styles.roomList}>
          {filtered.length === 0 ? (
            <p className={styles.emptyRooms}>No conversations yet.</p>
          ) : (
            filtered.map((room) => (
              <Link
                key={room.room_id}
                href={tenantHref(`/chat/${room.room_id}`)}
                className={cn(
                  styles.roomLink,
                  activeRoomId === room.room_id && styles.selected,
                )}
              >
                {room.type === "group" && !room.displayAvatar ? (
                  <span className={styles.groupAvatar}>
                    <Users className={styles.iconSm} />
                  </span>
                ) : (
                  <Avatar name={room.displayName} image={room.displayAvatar} size="md" />
                )}
                <div className={styles.roomInfo}>
                  <div className={styles.roomInfoTop}>
                    <p className={styles.roomName}>{room.displayName}</p>
                    <span className={styles.roomTime}>{timeAgo(room.last_message_at)}</span>
                  </div>
                  <p className={styles.roomSubtitle}>
                    {room.type === "group" ? `${room.memberCount} members` : "Direct message"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </nav>
      </aside>

      {/* Main window */}
      <main className={cn(styles.mainPane, activeRoomId ? styles.mainPaneVisible : "hidden md:flex")}>
        <div className={styles.mainPaneInner}>{children}</div>
      </main>

      <NewChatDialog open={newChatOpen} onClose={() => setNewChatOpen(false)} directory={directory} />
    </div>
  );
}

function NewChatDialog({ open, onClose, directory }: { open: boolean; onClose: () => void; directory: DirectoryUser[] }) {
  const router = useRouter();
  const { href: tenantHref } = useTenant();
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
      router.push(tenantHref(`/chat/${room.room_id}`));
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <div className={styles.dialogBackdrop}>
      <div className={styles.dialogCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.dialogTitle}>New conversation</h2>
          <button type="button" onClick={onClose} className={styles.dialogClose} aria-label="Close">
            <X className={styles.dialogCloseIcon} />
          </button>
        </div>

        {isGroup ? (
          <div className={styles.dialogField}>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className={styles.groupNameInput}
            />
          </div>
        ) : null}

        <div className={styles.dialogField}>
          <div className={styles.searchField}>
            <Search className={styles.searchIcon} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.peopleList}>
          {filtered.map((u) => (
            <button
              key={u.user_id}
              type="button"
              onClick={() => toggle(u.user_id)}
              className={cn(
                styles.personRow,
                selected.has(u.user_id) && styles.selected,
              )}
            >
              <Avatar name={u.full_name} image={u.profile_photo} size="sm" />
              <span className={styles.personName}>{u.full_name}</span>
              <span
                className={cn(
                  styles.personCheck,
                  selected.has(u.user_id) ? styles.personCheckOn : styles.personCheckOff,
                )}
              >
                {selected.has(u.user_id) ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.dialogFooter}>
          <button
            type="button"
            onClick={start}
            disabled={selected.size === 0 || pending}
            className={styles.dialogSubmit}
          >
            {pending ? "Creating…" : isGroup ? `Create group (${selected.size})` : "Start chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
