"use client";

import styles from "./chat-unread.module.css";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { appPathname } from "@/lib/tenant-path";
import { cn } from "@/lib/utils";

/** The newest message seen live in a room (drives the conversation list without a reload). */
export type LiveMessage = { room_id: string; sender_id: string; type: string; content: string; file_name: string | null; created_at: string };

type ChatUnread = {
  total: number;
  pops: number;
  /** Unread per room, from the server and then bumped live. */
  unreadByRoom: Record<string, number>;
  latestByRoom: Record<string, LiveMessage>;
};

const ChatUnreadContext = createContext<ChatUnread>({ total: 0, pops: 0, unreadByRoom: {}, latestByRoom: {} });

export const useChatUnread = () => useContext(ChatUnreadContext);

/**
 * Unread chat count for the Messages menu. Loads from the server on every navigation (opening a room
 * marks it read server-side) and bumps live when a message lands in one of the user's rooms.
 */
export function ChatUnreadProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const [latestByRoom, setLatestByRoom] = useState<Record<string, LiveMessage>>({});
  const [pops, setPops] = useState(0);
  const total = Object.values(unreadByRoom).reduce((sum, count) => sum + count, 0);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/chat/unread", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const body = (await response.json()) as { data?: { total?: number; roomIds?: string[]; unread?: Record<string, number> } };
    setUnreadByRoom(body.data?.unread ?? {});
    setRoomIds((current) => {
      const next = body.data?.roomIds ?? [];
      return current.length === next.length && current.every((id, index) => id === next[index]) ? current : next;
    });
  }, []);

  // Navigation (e.g. opening a room marks it read) and coming back to the tab both resync the count.
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 600);
    return () => window.clearTimeout(timer);
  }, [pathname, refresh]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Live: a new message from someone else, in a room you're not looking at, bumps the badge.
  useEffect(() => {
    if (!roomIds.length) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-unread:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=in.(${roomIds.slice(0, 100).join(",")})` },
        (payload) => {
          const row = payload.new as LiveMessage;
          if (!row.room_id) return;
          setLatestByRoom((current) => ({ ...current, [row.room_id]: row }));
          if (row.sender_id === userId || row.type === "system") return;
          if (appPathname(pathRef.current) === `/chat/${row.room_id}`) return;
          setUnreadByRoom((current) => ({ ...current, [row.room_id]: (current[row.room_id] ?? 0) + 1 }));
          setPops((current) => current + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomIds, userId]);

  return <ChatUnreadContext.Provider value={{ total, pops, unreadByRoom, latestByRoom }}>{children}</ChatUnreadContext.Provider>;
}

/** Red bubble with the unread count; pops each time a new message arrives. */
export function ChatUnreadBadge({ className }: { className?: string }) {
  const { total, pops } = useChatUnread();
  if (total <= 0) return null;
  return (
    <span key={pops} className={cn(styles.badge, pops > 0 && styles.pop, className)} aria-label={`${total} unread messages`}>
      {total > 99 ? "99+" : total}
    </span>
  );
}
