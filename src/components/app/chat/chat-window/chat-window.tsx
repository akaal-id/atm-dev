"use client";

import styles from "./chat-window.module.css";

import { ArrowDown, ArrowLeft, CheckSquare, Download, FilePlus2, Lock, Users, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

import type { OutgoingMessage } from "@/components/app/chat/chat-input";
import { MessageBubble } from "@/components/app/chat/message-bubble";
import { useTenant } from "@/components/app/tenant-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { downloadDocx, downloadPdf, htmlToBlocks, type DocBlock } from "@/lib/document-export";
import { requestJson } from "@/lib/request-json";
import { hydrateMessage, markRoomRead, sendMessage } from "@/lib/server/chat-actions";
import { createClient } from "@/lib/supabase/client";
import type { ChatAuthor, ChatMessage, ChatMessageView, ChatRoom, RoomMember } from "@/lib/types/chat";
import type { OfficeFile } from "@/lib/types/office";
import { cn, makeId } from "@/lib/utils";

const ChatInput = dynamic(
  () => import("@/components/app/chat/chat-input").then((mod) => mod.ChatInput),
  {
    ssr: false,
    loading: () => <div className={styles.chatinput} aria-hidden />,
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

/** "Today", "Yesterday", or a date — the divider shown when the day changes. */
function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" }).format(date);
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function noteStamp(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** A note's body as HTML, including its attachment / task reference. */
function noteHtml(message: ChatMessageView) {
  let html = message.content || "";
  if (message.file_url) html += `<p><a href="${escapeHtml(message.file_url)}">${escapeHtml(message.file_name ?? "Attachment")}</a></p>`;
  if (message.task) html += `<p>Task ${escapeHtml(message.task.task_id)}: ${escapeHtml(message.task.title)}</p>`;
  return html;
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
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();
  const isNotes = room.type === "self";
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const readTimer = useRef<number | null>(null);

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
          // Seen while open → keep the room marked read (debounced).
          if (document.visibilityState === "visible") {
            if (readTimer.current) window.clearTimeout(readTimer.current);
            readTimer.current = window.setTimeout(() => void markRoomRead(room.room_id).catch(() => null), 1500);
          }
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

  // Follow new messages only when already at the bottom (or it's your own send);
  // otherwise offer a "new messages" jump button instead of yanking the scroll.
  const lastMessage = optimisticMessages[optimisticMessages.length - 1];
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (nearBottomRef.current || lastMessage?.sender_id === currentUser.user_id) {
      node.scrollTo({ top: node.scrollHeight });
      setShowJump(false);
    } else {
      setShowJump(true);
    }
  }, [optimisticMessages.length, lastMessage?.sender_id, currentUser.user_id]);

  function onScroll() {
    const node = scrollRef.current;
    if (!node) return;
    nearBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
    if (nearBottomRef.current) setShowJump(false);
  }

  function jumpToLatest() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setShowJump(false);
  }

  const selectable = optimisticMessages.filter((message) => !message.pending && message.type !== "system");
  const selectedNotes = selectable.filter((message) => selected.has(message.message_id));

  function toggleNote(messageId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  const notesTitle = () => `Notes ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date())}`;

  async function exportNotes(format: "docx" | "pdf" | "office") {
    if (selectedNotes.length === 0 || exporting) return;
    setExporting(true);
    const title = notesTitle();
    try {
      if (format === "office") {
        const content = selectedNotes.map((note) => `<p><em>${escapeHtml(noteStamp(note.created_at))}</em></p>${noteHtml(note)}`).join("");
        const file = await requestJson<OfficeFile>("/api/office", "POST", { type: "doc", scope: "personal", title, content });
        pushToast({ tone: "success", title: "Saved to Office › Personal notes" });
        stopSelecting();
        router.push(tenant.href(`/office/${file.file_id}`));
        return;
      }
      const blocks: DocBlock[] = [
        { kind: "title", runs: [{ text: title }] },
        ...selectedNotes.flatMap((note) => [{ kind: "meta" as const, runs: [{ text: noteStamp(note.created_at) }] }, ...htmlToBlocks(noteHtml(note))]),
      ];
      await (format === "docx" ? downloadDocx(title, blocks) : downloadPdf(title, blocks));
    } catch (error) {
      pushToast({ tone: "error", title: "Export failed", description: error instanceof Error ? error.message : undefined });
    } finally {
      setExporting(false);
    }
  }

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
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <Link href={tenant.href("/chat")} className={styles.headerHeader} aria-label="Back to conversations">
          <ArrowLeft className={styles.headerBack} />
        </Link>
        {isNotes ? (
          <span className={styles.notesAvatar} aria-hidden>
            <Lock className={styles.headerBack} />
          </span>
        ) : (
          <Avatar name={title} image={room.type === "group" ? room.avatar_url : undefined} size="sm" />
        )}
        <div className={styles.content}>
          <p className={styles.itemDescription}>{title}</p>
          <p className={styles.back}>
            {isNotes ? "Only you can see these notes" : room.type === "group" ? `${roomMembers.length} members` : "Direct message"}
          </p>
        </div>
        {isNotes ? (
          <Button
            type="button"
            variant={selecting ? "secondary" : "outline"}
            size="sm"
            className={styles.selectToggle}
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            disabled={selectable.length === 0}
          >
            {selecting ? <X className={styles.actionIcon} aria-hidden /> : <CheckSquare className={styles.actionIcon} aria-hidden />}
            {selecting ? "Cancel" : "Select"}
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className={styles.button}
            aria-label="Members"
          >
            <Users className={styles.headerBack} />
          </button>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className={styles.messages} onScroll={onScroll}>
        {optimisticMessages.map((message, index) => {
          const prev = optimisticMessages[index - 1];
          const isOwn = message.sender_id === currentUser.user_id;
          const newDay = !prev || !sameDay(prev.created_at, message.created_at);
          // Consecutive messages from one person within 5 minutes form one group.
          const grouped = !newDay && prev.sender_id === message.sender_id && prev.type !== "system" && Date.parse(message.created_at) - Date.parse(prev.created_at) < 300_000;
          const bubble = <MessageBubble message={message} isOwn={isOwn} showAuthor={!grouped} withAvatar={room.type === "group"} />;
          const divider = newDay ? (
            <div className={styles.dayDivider} role="separator">
              <span>{dayLabel(message.created_at)}</span>
            </div>
          ) : null;
          if (!selecting || message.pending || message.type === "system") {
            return (
              <div key={message.message_id} className={grouped ? styles.grouped : styles.ungrouped}>
                {divider}
                {bubble}
              </div>
            );
          }
          const checked = selected.has(message.message_id);
          return (
            <div key={message.message_id} className={grouped ? styles.grouped : styles.ungrouped}>
              {divider}
              <label className={cn(styles.selectRow, checked && styles.selectRowActive)}>
                <input type="checkbox" className={styles.selectBox} checked={checked} onChange={() => toggleNote(message.message_id)} />
                <div className={styles.selectBubble}>{bubble}</div>
              </label>
            </div>
          );
        })}
        {optimisticMessages.length === 0 ? (
          <p className={styles.itemMeta}>
            {isNotes
              ? "Write notes to yourself here. Later, select them to download as DOCX / PDF or save them to Office."
              : "No messages yet. Say hello 👋"}
          </p>
        ) : null}
      </div>

      {showJump ? (
        <button type="button" className={styles.jump} onClick={jumpToLatest}>
          <ArrowDown aria-hidden />
          New messages
        </button>
      ) : null}

      <div className={styles.dialogPanel}>
        {selecting ? (
          <div className={styles.selectBar} role="toolbar" aria-label="Selected notes">
            <span className={styles.selectCount}>{selectedNotes.length} selected</span>
            <button
              type="button"
              className={styles.selectAll}
              onClick={() =>
                setSelected(selectedNotes.length === selectable.length ? new Set() : new Set(selectable.map((message) => message.message_id)))
              }
            >
              {selectedNotes.length === selectable.length ? "Clear" : "Select all"}
            </button>
            <div className={styles.selectActions}>
              <Button type="button" variant="outline" size="sm" disabled={!selectedNotes.length || exporting} onClick={() => void exportNotes("docx")}>
                <Download className={styles.actionIcon} aria-hidden />
                DOCX
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!selectedNotes.length || exporting} onClick={() => void exportNotes("pdf")}>
                <Download className={styles.actionIcon} aria-hidden />
                PDF
              </Button>
              <Button type="button" size="sm" disabled={!selectedNotes.length || exporting} onClick={() => void exportNotes("office")}>
                <FilePlus2 className={styles.actionIcon} aria-hidden />
                Save to Office
              </Button>
            </div>
          </div>
        ) : (
          <ChatInput onSend={handleSend} />
        )}
      </div>

      {isNotes ? null : <MembersDialog
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        roomId={room.room_id}
        members={roomMembers}
        directory={directory}
        canManage={canManage}
        canRemoveOthers={canRemoveOthers}
        currentUserId={currentUser.user_id}
        roomType={room.type === "group" ? "group" : "private"}
      />}
    </div>
  );
}
