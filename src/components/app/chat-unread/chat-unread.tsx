"use client";

import styles from "./chat-unread.module.css";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { appPathname } from "@/lib/tenant-path";
import { cn } from "@/lib/utils";

type ChatUnread = { total: number; pops: number };

const ChatUnreadContext = createContext<ChatUnread>({ total: 0, pops: 0 });

export const useChatUnread = () => useContext(ChatUnreadContext);

/**
 * Unread chat count for the Messages menu. Loads from the server on every navigation (opening a room
 * marks it read server-side) and bumps live when a message lands in one of the user's rooms.
 */
export function ChatUnreadProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [total, setTotal] = useState(0);
  const [pops, setPops] = useState(0);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/chat/unread", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const body = (await response.json()) as { data?: { total?: number; roomIds?: string[] } };
    setTotal(body.data?.total ?? 0);
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
          const row = payload.new as { room_id?: string; sender_id?: string; type?: string };
          if (!row.room_id || row.sender_id === userId || row.type === "system") return;
          if (appPathname(pathRef.current) === `/chat/${row.room_id}`) return;
          setTotal((current) => current + 1);
          setPops((current) => current + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomIds, userId]);

  return <ChatUnreadContext.Provider value={{ total, pops }}>{children}</ChatUnreadContext.Provider>;
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
