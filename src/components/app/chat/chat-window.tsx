"use client";

import { ArrowLeft, Users } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

import type { OutgoingMessage } from "@/components/app/chat/chat-input";
import { MessageBubble } from "@/components/app/chat/message-bubble";
import { Avatar } from "@/components/ui/avatar";
import { hydrateMessage, sendMessage } from "@/lib/server/chat-actions";
import { createClient } from "@/lib/supabase/client";
import type { ChatAuthor, ChatMessage, ChatMessageView, ChatRoom, RoomMember } from "@/lib/types/chat";
import { makeId } from "@/lib/utils";

const ChatInput = dynamic(
  () => import("@/components/app/chat/chat-input").then((mod) => mod.ChatInput),
  {
    ssr: false,
    loading: () => <div className="h-[58px] border-t border-slate-200 bg-white" aria-hidden />,
  },
);

const MembersDialog = dynamic(
  () => import("@/components/app/chat/members-dialog").then((mod) => mod.MembersDialog),
  { ssr: false },
);

type MemberRow = RoomMember & { author: ChatAuthor | null };

interface DirectoryUser {
  user_id: string;
  full_name: string;
  profile_photo: string;
}

interface ChatWindowProps {
  currentUser: ChatAuthor & { role_id: string };
  room: ChatRoom;
  title: string;
  members: MemberRow[];
  initialMessages: ChatMessageView[];
  directory: DirectoryUser[];
  canManage: boolean;
  canRemoveOthers: boolean;
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function mergeMessage(list: ChatMessageView[], incoming: ChatMessageView) {
  const index = list.findIndex((m) => m.message_id === incoming.message_id);
  const next = index === -1 ? [...list, incoming] : list.map((m) => (m.message_id === incoming.message_id ? incoming : m));
  return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function ChatWindow({ currentUser, room, title, members, initialMessages, directory, canManage, canRemoveOthers }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [roomMembers, setRoomMembers] = useState(members);
  const [optimisticMessages, addOptimistic] = useOptimistic(messages, (state, msg: ChatMessageView) =>
    mergeMessage(state, msg),
  );
  const [membersOpen, setMembersOpen] = useState(false);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const authorMap = useRef(
    new Map(roomMembers.map((m) => [m.user_id, m.author]).filter(([, a]) => a) as [string, ChatAuthor][]),
  );

  // Realtime: stream new messages + member changes from other clients.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${room.room_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${room.room_id}` },
        async (payload) => {
          const row = payload.new as ChatMessage;
          // Our own sends are reconciled from the server action's return value.
          if (row.sender_id === currentUser.user_id) return;

          let view: ChatMessageView;
          if (row.task_id) {
            const hydrated = await hydrateMessage(row.message_id);
            view = hydrated ?? { ...row, author: authorMap.current.get(row.sender_id) ?? null, task: null };
          } else {
            view = { ...row, author: authorMap.current.get(row.sender_id) ?? null, task: null };
          }
          setMessages((prev) => mergeMessage(prev, view));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${room.room_id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as RoomMember;
            const author = directory.find((u) => u.user_id === row.user_id);
            setRoomMembers((prev) =>
              prev.some((m) => m.user_id === row.user_id)
                ? prev
                : [...prev, { ...row, author: author ? { ...author } : null }],
            );
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as RoomMember;
            setRoomMembers((prev) => prev.filter((m) => m.user_id !== row.user_id));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room.room_id, currentUser.user_id, directory]);

  // Keep the view pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [optimisticMessages.length]);

  function handleSend(payload: OutgoingMessage) {
    const messageId = makeId("msg");
    const optimistic: ChatMessageView = {
      message_id: messageId,
      room_id: room.room_id,
      sender_id: currentUser.user_id,
      type: payload.type ?? "text",
      content: payload.content,
      file_url: payload.file_url ?? null,
      file_name: payload.file_name ?? null,
      file_mime: payload.file_mime ?? null,
      task_id: payload.task_id ?? null,
      link_preview: null,
      reply_to: payload.reply_to ?? null,
      created_at: new Date().toISOString(),
      author: { ...currentUser },
      task: null,
      pending: true,
    };

    startTransition(async () => {
      addOptimistic(optimistic);
      try {
        const saved = await sendMessage({ ...payload, message_id: messageId, room_id: room.room_id });
        setMessages((prev) => mergeMessage(prev, saved));
      } catch (error) {
        console.error(error);
        // Drop the optimistic bubble on failure.
        setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link href="/chat" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar name={title} image={room.type === "group" ? room.avatar_url : undefined} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-[11px] text-slate-400">
            {room.type === "group" ? `${roomMembers.length} members` : "Direct message"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMembersOpen(true)}
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label="Members"
        >
          <Users className="h-5 w-5" />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain px-3 py-4">
        {optimisticMessages.map((message, index) => {
          const prev = optimisticMessages[index - 1];
          const isOwn = message.sender_id === currentUser.user_id;
          const showAuthor = !prev || prev.sender_id !== message.sender_id || !sameDay(prev.created_at, message.created_at);
          return <MessageBubble key={message.message_id} message={message} isOwn={isOwn} showAuthor={showAuthor} />;
        })}
        {optimisticMessages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No messages yet. Say hello 👋</p>
        ) : null}
      </div>

      <div className="mt-auto shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)]">
        <ChatInput onSend={handleSend} />
      </div>

      <MembersDialog
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        roomId={room.room_id}
        members={roomMembers}
        directory={directory}
        canManage={canManage}
        canRemoveOthers={canRemoveOthers}
        currentUserId={currentUser.user_id}
        roomType={room.type}
      />
    </div>
  );
}
