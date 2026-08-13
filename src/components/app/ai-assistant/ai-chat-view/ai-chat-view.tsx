"use client";

import styles from "./ai-chat-view.module.css";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Bot,
  History,
  Info,
  ListTodo,
  LogOut,
  Mic,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { AiContextPanel, type ActiveContext, type TaskListItem } from "@/components/app/ai-assistant/ai-context-panel";
import { AiMutationCard } from "@/components/app/ai-assistant/ai-mutation-card";
import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import { ATM_CONFIRM_PREFIX, isAiMutationTool, type WorkflowListItem } from "@/lib/ai/mutation";
import type { AiTaskDetail, AiTaskPickItem } from "@/lib/ai/task-detail";
import type { AiConversationSummary } from "@/lib/types/ai-chat";
import { cn } from "@/lib/utils";

type AiChatMessage = UIMessage<
  never,
  never,
  {
    getMyTasks: {
      input: { scope?: "assigned" | "accessible" };
      output: TaskListItem[];
    };
    getTask: {
      input: { taskId?: string; query?: string };
      output:
        | { ok: true; task: AiTaskDetail }
        | { ok: false; error: string }
        | { ok: false; pick: true; tasks: AiTaskPickItem[] };
    };
    rememberFact: {
      input: { key: string; value: string };
      output: { ok: boolean; key: string; value: string; factCount: number };
    };
    listWorkflows: {
      input: Record<string, never>;
      output: { workflows: WorkflowListItem[] };
    };
    getWorkflow: {
      input: { workflowId: string };
      output: { ok: boolean; workflow?: WorkflowListItem; error?: string };
    };
    createTask: { input: Record<string, unknown>; output: unknown };
    updateTask: { input: Record<string, unknown>; output: unknown };
    createChecklist: { input: Record<string, unknown>; output: unknown };
    createWorkflow: { input: Record<string, unknown>; output: unknown };
    updateWorkflow: { input: Record<string, unknown>; output: unknown };
    deleteWorkflow: { input: Record<string, unknown>; output: unknown };
  }
>;

function formatConversationTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SUGGESTIONS = [
  "Tampilkan task saya hari ini",
  "Mana yang overdue?",
  "Bantu prioritaskan kerjaan",
] as const;

/** Inline markdown: bold, italic, code. */
function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={index} className={styles.inlineCode}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

const ORDERED_RE = /^(\d+)\.\s+(.*)$/;
const BULLET_RE = /^[-*•]\s+(.*)$/;

/** Block markdown: paragraphs + ordered/bullet lists. */
function renderMessageContent(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const ordered = lines[i].match(ORDERED_RE);
    const bullet = lines[i].match(BULLET_RE);

    if (ordered) {
      const items: { n: number; body: string }[] = [];
      while (i < lines.length) {
        const match = lines[i].match(ORDERED_RE);
        if (!match) break;
        items.push({ n: Number(match[1]), body: match[2] });
        i += 1;
      }
      nodes.push(
        <ol key={key++} className={cn(styles.mdList, styles.mdNumber)} start={items[0]?.n ?? 1}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item.body)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (bullet) {
      const items: string[] = [];
      while (i < lines.length) {
        const match = lines[i].match(BULLET_RE);
        if (!match) break;
        items.push(match[1]);
        i += 1;
      }
      nodes.push(
        <ul key={key++} className={cn(styles.mdList, styles.mdBullet)}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (lines[i] === "") {
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i] !== "" && !ORDERED_RE.test(lines[i]) && !BULLET_RE.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    nodes.push(
      <p key={key++} className={styles.mdParagraph}>
        {para.map((line, idx) => (
          <span key={idx}>
            {idx > 0 ? <br /> : null}
            {renderInlineMarkdown(line)}
          </span>
        ))}
      </p>,
    );
  }

  return nodes.length > 0 ? nodes : renderInlineMarkdown(text);
}

function resizeComposer(el: HTMLTextAreaElement) {
  el.style.height = "0px";
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 24), 160)}px`;
}

function continueListOnEnter(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): { next: string; cursor: number } | null {
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const lineStart = before.lastIndexOf("\n") + 1;
  const currentLine = before.slice(lineStart);

  const ordered = currentLine.match(/^(\d+)\.\s(.*)$/);
  const bullet = currentLine.match(/^([-*•])\s(.*)$/);

  if (ordered) {
    const marker = `${ordered[1]}. `;
    if (ordered[2] === "" && currentLine === marker) {
      // empty item → exit list
      const next = `${before.slice(0, lineStart)}${after}`;
      return { next, cursor: lineStart };
    }
    const nextNum = Number(ordered[1]) + 1;
    const insert = `\n${nextNum}. `;
    const next = `${before}${insert}${after}`;
    return { next, cursor: before.length + insert.length };
  }

  if (bullet) {
    const marker = `${bullet[1]} `;
    if (bullet[2] === "" && currentLine === marker) {
      const next = `${before.slice(0, lineStart)}${after}`;
      return { next, cursor: lineStart };
    }
    const insert = `\n${bullet[1]} `;
    const next = `${before}${insert}${after}`;
    return { next, cursor: before.length + insert.length };
  }

  return null;
}

/**
 * Full chat UI (history sidebar + thread + composer), minus the open/close
 * trigger — the caller decides when this mounts. `variant="overlay"` locks
 * body scroll and renders fixed full-viewport (modal use); `variant="page"`
 * renders as normal in-flow content (standalone route use). Same component
 * either way — one implementation, no duplicated markup/CSS.
 */
export function AiChatView({
  variant,
  pagePath: pagePathProp,
  onClose,
}: {
  variant: "overlay" | "page";
  /** Page the user was on before opening chat. Falls back to usePathname() when omitted (modal use, where this route's own pathname IS that page). */
  pagePath?: string;
  /** Defaults to router.back() — the standalone-route case (modal use always passes this explicitly). */
  onClose?: () => void;
}) {
  // Stable across conversation switches — avoids useChat's id-keyed message
  // store racing with setMessages() when loadConversation() swaps both in
  // the same render cycle. conversationId (below) still tracks which
  // conversation is active for the sidebar highlight and API requests.
  const chatSessionId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const pagePath = pagePathProp ?? pathname;
  const close = onClose ?? (() => router.back());
  const { href: tenantHref } = useTenant();
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("Chat baru");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const creatingRef = useRef<Promise<string> | null>(null);
  const pagePathRef = useRef(pagePath);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingLimitRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const lastContextKeyRef = useRef<string | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    pagePathRef.current = pagePath;
  }, [pagePath]);

  const transport = useRef(
    new DefaultChatTransport<AiChatMessage>({
      api: "/api/ai/chat",
      prepareSendMessagesRequest: ({ messages, id, body }) => ({
        body: {
          ...body,
          id,
          messages,
          conversationId: conversationIdRef.current,
          pagePath: pagePathRef.current,
        },
      }),
    }),
  ).current;

  const { messages, sendMessage, setMessages, status, error } = useChat<AiChatMessage>({
    id: chatSessionId,
    transport,
  });
  const isLoading = status === "submitted" || status === "streaming";

  // Left panel mirrors whichever list/detail tool call was made most recently —
  // derived from messages (not duplicated state), so it always tracks the
  // latest getMyTasks/getTask/listWorkflows/getWorkflow result.
  const activeContext = useMemo<ActiveContext | null>(() => {
    for (let mi = messages.length - 1; mi >= 0; mi--) {
      const parts = messages[mi].parts;
      for (let pi = parts.length - 1; pi >= 0; pi--) {
        const part = parts[pi];
        const key = `${messages[mi].id}-${pi}`;
        if (part.type === "tool-getMyTasks" && part.state === "output-available") {
          return { kind: "tasks", key, tasks: part.output ?? [] };
        }
        if (part.type === "tool-getTask" && part.state === "output-available") {
          return { kind: "taskDetail", key, output: part.output };
        }
        if (part.type === "tool-listWorkflows" && part.state === "output-available") {
          return { kind: "workflows", key, workflows: part.output?.workflows ?? [] };
        }
        if (part.type === "tool-getWorkflow" && part.state === "output-available") {
          const wf = part.output && part.output.ok !== false ? part.output.workflow : undefined;
          return { kind: "workflows", key, workflows: wf ? [wf] : [] };
        }
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (activeContext && activeContext.key !== lastContextKeyRef.current) {
      setShowContextPanel(true);
    }
    lastContextKeyRef.current = activeContext?.key ?? null;
  }, [activeContext]);

  async function refreshConversations() {
    const response = await fetch("/api/ai/conversations", { cache: "no-store" });
    if (!response.ok) throw new Error("Gagal memuat riwayat.");
    const json = (await response.json()) as { data: AiConversationSummary[] };
    setConversations(json.data ?? []);
    return json.data ?? [];
  }

  async function loadConversation(id: string) {
    const response = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Gagal membuka chat.");
    const json = (await response.json()) as {
      data: { conversation: AiConversationSummary; messages: AiChatMessage[] };
    };
    creatingRef.current = null;
    conversationIdRef.current = json.data.conversation.conversation_id;
    setConversationId(json.data.conversation.conversation_id);
    setConversationTitle(json.data.conversation.title || "Chat baru");
    setMessages(json.data.messages ?? []);
    setShowHistory(false);
  }

  async function ensureConversation() {
    if (conversationIdRef.current) return conversationIdRef.current;
    if (creatingRef.current) return creatingRef.current;

    creatingRef.current = (async () => {
      const response = await fetch("/api/ai/conversations", { method: "POST" });
      if (!response.ok) throw new Error("Gagal membuat chat baru.");
      const json = (await response.json()) as { data: AiConversationSummary };
      conversationIdRef.current = json.data.conversation_id;
      setConversationId(json.data.conversation_id);
      setConversationTitle(json.data.title || "Chat baru");
      setConversations((prev) => [
        json.data,
        ...prev.filter((row) => row.conversation_id !== json.data.conversation_id),
      ]);
      return json.data.conversation_id;
    })();

    try {
      return await creatingRef.current;
    } finally {
      creatingRef.current = null;
    }
  }

  function startNewConversation() {
    creatingRef.current = null;
    conversationIdRef.current = null;
    setConversationId(null);
    setConversationTitle("Chat baru");
    setMessages([]);
    setShowHistory(false);
    setHistoryError(null);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (recording) {
        event.preventDefault();
        cancelRecording();
        return;
      }
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, recording]);

  useEffect(() => {
    return () => {
      cancelRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  useEffect(() => {
    if (variant !== "overlay") return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
    };
    const scrollbarGap = window.innerWidth - html.clientWidth;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.paddingRight = previous.bodyPaddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [variant]);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  async function sendPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    try {
      await ensureConversation();
    } catch (err) {
      console.error(err);
      setHistoryError("Gagal membuat chat baru.");
      return;
    }
    sendMessage({ text: trimmed });
    setConversationTitle((prev) => (prev === "Chat baru" ? trimmed.slice(0, 60) : prev));
  }

  async function sendVoice(blob: Blob) {
    if (blob.size < 2000) {
      setVoiceError("Rekaman terlalu pendek. Coba lagi.");
      return;
    }
    try {
      await ensureConversation();
    } catch (err) {
      console.error(err);
      setHistoryError("Gagal membuat chat baru.");
      return;
    }
    const mediaType = (blob.type || "audio/webm").split(";")[0] || "audio/webm";
    const file = new File([blob], mediaType.includes("mp4") ? "voice.m4a" : "voice.webm", {
      type: mediaType,
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    sendMessage({ files: transfer.files });
    setConversationTitle((prev) => (prev === "Chat baru" ? "Pesan suara" : prev));
  }

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (recordingLimitRef.current != null) {
      window.clearTimeout(recordingLimitRef.current);
      recordingLimitRef.current = null;
    }
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;
    audioChunksRef.current = [];
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = () => {
        stopMediaStream();
        mediaRecorderRef.current = null;
      };
      recorder.stop();
    } else {
      stopMediaStream();
    }
    setRecording(false);
  }

  async function toggleRecording() {
    if (isLoading) return;
    setVoiceError(null);

    if (recording) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Browser ini belum mendukung rekaman suara.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        stopMediaStream();
        mediaRecorderRef.current = null;
        setRecording(false);
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        void sendVoice(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      recordingLimitRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      }, 60_000);
    } catch (err) {
      console.error(err);
      stopMediaStream();
      setRecording(false);
      setVoiceError("Mikrofon ditolak atau sedang dipakai aplikasi lain.");
    }
  }

  function submitDraft() {
    const text = draft.trim();
    if (!text || isLoading || recording) return;
    setDraft("");
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      resizeComposer(el);
    });
    void sendPrompt(text);
  }

  async function handleDeleteConversation(id: string) {
    const response = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setHistoryError("Gagal menghapus chat.");
      return;
    }
    const next = conversations.filter((row) => row.conversation_id !== id);
    setConversations(next);
    if (conversationId === id) {
      if (next[0]) {
        await loadConversation(next[0].conversation_id);
      } else {
        startNewConversation();
      }
    }
  }

  return (
    <div className={cn(styles.layer, variant === "page" && styles.page)}>
      <section
        className={styles.room}
        role="dialog"
        aria-modal={variant === "overlay" ? "true" : undefined}
        aria-label="Asisten ATM"
      >
        <AiContextPanel
          open={showContextPanel}
          context={activeContext}
          onClose={() => setShowContextPanel(false)}
          taskHref={(taskId) => tenantHref(`/tasks/${taskId}`)}
          workflowHref={(workflowId) => tenantHref(`/workflows/${workflowId}`)}
          onNavigate={close}
          onSendPrompt={(promptText) => {
            if (!isLoading) void sendPrompt(promptText);
          }}
        />

        {showHistory ? (
          <button
            type="button"
            className={styles.sidebarScrim}
            aria-label="Tutup riwayat"
            onClick={() => setShowHistory(false)}
          />
        ) : null}

        <aside
          className={cn(styles.sidebar, showHistory && styles.sidebarOpen)}
          aria-hidden={!showHistory}
        >
          <div className={styles.sidebarHeader}>
            <p className={styles.sidebarTitle}>Riwayat chat</p>
          </div>
          <div className={styles.history}>
            {historyError ? <p className={styles.historyError}>{historyError}</p> : null}
            {conversations.length === 0 ? (
              <p className={styles.historyEmpty}>Belum ada riwayat chat.</p>
            ) : (
              <ul className={styles.historyList}>
                {conversations.map((row) => (
                  <li key={row.conversation_id} className={styles.historyItem}>
                    <button
                      type="button"
                      className={cn(
                        styles.historyButton,
                        row.conversation_id === conversationId && styles.historyButtonActive,
                      )}
                      onClick={() => {
                        void loadConversation(row.conversation_id).catch(() =>
                          setHistoryError("Gagal membuka chat."),
                        );
                      }}
                    >
                      <span className={styles.historyTitle}>{row.title || "Chat baru"}</span>
                      <span className={styles.historyMeta}>
                        {formatConversationTime(row.last_message_at || row.updated_at)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${row.title || "chat"}`}
                      className={styles.historyDelete}
                      onClick={() => {
                        void handleDeleteConversation(row.conversation_id);
                      }}
                    >
                      <Trash2 className={styles.actionIcon} aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topBar}>
            <div className={styles.topBarSide} />
            <div className={styles.topBarCenter}>
              <img
                src="/icon/mono-akaal-white.png"
                alt="Akaal Team Management"
                className={styles.headerLogo}
                width={32}
                height={32}
              />
            </div>
            <div className={styles.topBarSide} aria-hidden />
          </header>

          <div ref={listRef} className={styles.thread}>
            <div className={styles.threadInner}>
              {!historyError && messages.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyBadge} aria-hidden>
                    <Sparkles className={styles.emptyIcon} />
                  </div>
                  <h3 className={styles.emptyTitle}>Ada yang bisa dibantu?</h3>
                  <p className={styles.emptyCopy}>
                    Tanya soal task, update progres, atau minta rekomendasi kerja.
                  </p>
                  <div className={styles.suggestionRow}>
                    {SUGGESTIONS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className={styles.suggestionChip}
                        disabled={isLoading}
                        onClick={() => {
                          if (isLoading) return;
                          void sendPrompt(prompt);
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {historyError ? (
                <div className={cn(styles.row, styles.rowAssistant)}>
                  <div className={styles.bubbleError}>{historyError}</div>
                </div>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    styles.row,
                    message.role === "user" ? styles.rowUser : styles.rowAssistant,
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className={styles.assistantMark} aria-hidden>
                      <Bot className={styles.assistantMarkIcon} />
                    </div>
                  ) : null}
                  <div className={styles.stack}>
                    {message.parts.map((part, index) => {
                      if (part.type === "text" && part.text.trim()) {
                        const confirmNote = part.text.startsWith(ATM_CONFIRM_PREFIX);
                        return (
                          <div
                            key={`${message.id}-text-${index}`}
                            className={cn(
                              styles.bubble,
                              message.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
                            )}
                          >
                            {confirmNote ? "Dikonfirmasi." : renderMessageContent(part.text)}
                          </div>
                        );
                      }

                      if (part.type === "file") {
                        const isAudio = part.mediaType.startsWith("audio");
                        return (
                          <div
                            key={`${message.id}-file-${index}`}
                            className={cn(
                              styles.bubble,
                              message.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
                            )}
                          >
                            <span className={styles.voiceNote}>
                              <Mic className={styles.voiceNoteIcon} aria-hidden />
                              {isAudio ? "Pesan suara" : part.filename || "File"}
                            </span>
                          </div>
                        );
                      }

                      if (part.type === "tool-getMyTasks") {
                        if (part.state === "input-streaming" || part.state === "input-available") {
                          return (
                            <div key={part.toolCallId} className={styles.taskLoading}>
                              Memuat task…
                            </div>
                          );
                        }
                        if (part.state === "output-error") {
                          return (
                            <div key={part.toolCallId} className={styles.taskEmpty}>
                              Gagal memuat task.
                            </div>
                          );
                        }
                        if (part.state !== "output-available") return null;
                        const chipKey = `${message.id}-${index}`;
                        const isCurrent = activeContext?.key === chipKey;
                        const isActive = isCurrent && showContextPanel;
                        const isDisabled = !isCurrent;
                        return (
                          <button
                            key={part.toolCallId}
                            type="button"
                            className={cn(
                              styles.contextRefChip,
                              isActive && styles.contextRefChipActive,
                              isDisabled && styles.contextRefChipDisabled,
                            )}
                            disabled={isDisabled}
                            onClick={() => setShowContextPanel((v) => (isActive ? !v : true))}
                          >
                            <ListTodo className={cn(styles.contextRefChipIcon, isActive && styles.contextRefChipIconActive)} aria-hidden />
                            {part.output?.length ?? 0} task aktif
                          </button>
                        );
                      }

                      if (part.type === "tool-getTask") {
                        if (part.state === "input-streaming" || part.state === "input-available") {
                          return (
                            <div key={part.toolCallId} className={styles.taskLoading}>
                              Memuat detail task…
                            </div>
                          );
                        }
                        if (part.state !== "output-available") return null;
                        const chipKey = `${message.id}-${index}`;
                        const isCurrent = activeContext?.key === chipKey;
                        const isActive = isCurrent && showContextPanel;
                        const isDisabled = !isCurrent;
                        return (
                          <button
                            key={part.toolCallId}
                            type="button"
                            className={cn(
                              styles.contextRefChip,
                              isActive && styles.contextRefChipActive,
                              isDisabled && styles.contextRefChipDisabled,
                            )}
                            disabled={isDisabled}
                            onClick={() => setShowContextPanel((v) => (isActive ? !v : true))}
                          >
                            <Info className={cn(styles.contextRefChipIcon, isActive && styles.contextRefChipIconActive)} aria-hidden />
                            Detail task
                          </button>
                        );
                      }

                      const toolName = part.type.startsWith("tool-") ? part.type.slice("tool-".length) : "";
                      if (isAiMutationTool(toolName)) {
                        return (
                          <AiMutationCard
                            key={"toolCallId" in part ? part.toolCallId : `${message.id}-${toolName}-${index}`}
                            tool={toolName}
                            state={"state" in part ? String(part.state) : "output-available"}
                            output={"output" in part ? part.output : undefined}
                            onConfirm={(promptText) => {
                              if (!isLoading) void sendPrompt(promptText);
                            }}
                            taskHref={(taskId) => tenantHref(`/tasks/${taskId}`)}
                            workflowHref={(workflowId) => tenantHref(`/workflows/${workflowId}`)}
                            onNavigate={close}
                          />
                        );
                      }

                      if (part.type === "tool-listWorkflows") {
                        if (part.state === "input-streaming" || part.state === "input-available") {
                          return (
                            <div key={part.toolCallId} className={styles.taskLoading}>
                              Memuat workflow…
                            </div>
                          );
                        }
                        if (part.state !== "output-available") return null;
                        const chipKey = `${message.id}-${index}`;
                        const isCurrent = activeContext?.key === chipKey;
                        const isActive = isCurrent && showContextPanel;
                        const isDisabled = !isCurrent;
                        return (
                          <button
                            key={part.toolCallId}
                            type="button"
                            className={cn(
                              styles.contextRefChip,
                              isActive && styles.contextRefChipActive,
                              isDisabled && styles.contextRefChipDisabled,
                            )}
                            disabled={isDisabled}
                            onClick={() => setShowContextPanel((v) => (isActive ? !v : true))}
                          >
                            <ListTodo className={cn(styles.contextRefChipIcon, isActive && styles.contextRefChipIconActive)} aria-hidden />
                            {part.output?.workflows?.length ?? 0} workflow
                          </button>
                        );
                      }

                      if (part.type === "tool-getWorkflow") {
                        if (part.state === "output-available" && part.output && part.output.ok === false) {
                          return (
                            <div key={part.toolCallId} className={styles.taskEmpty}>
                              {part.output.error || "Workflow tidak ditemukan."}
                            </div>
                          );
                        }
                        if (part.state !== "output-available") return null;
                        const chipKey = `${message.id}-${index}`;
                        const isCurrent = activeContext?.key === chipKey;
                        const isActive = isCurrent && showContextPanel;
                        const isDisabled = !isCurrent;
                        return (
                          <button
                            key={part.toolCallId}
                            type="button"
                            className={cn(
                              styles.contextRefChip,
                              isActive && styles.contextRefChipActive,
                              isDisabled && styles.contextRefChipDisabled,
                            )}
                            disabled={isDisabled}
                            onClick={() => setShowContextPanel((v) => (isActive ? !v : true))}
                          >
                            <ListTodo className={cn(styles.contextRefChipIcon, isActive && styles.contextRefChipIconActive)} aria-hidden />
                            Detail workflow
                          </button>
                        );
                      }

                      if (part.type === "tool-rememberFact" && part.state === "output-available") {
                        return (
                          <div key={part.toolCallId} className={styles.memoryNote}>
                            Disimpan ke memory: {part.output.key}
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              ))}
              {isLoading ? (
                <div className={cn(styles.row, styles.rowAssistant)}>
                  <div className={styles.assistantMark} aria-hidden>
                    <Bot className={styles.assistantMarkIcon} />
                  </div>
                  <div className={cn(styles.bubble, styles.bubbleAssistant)}>
                    <span className={styles.typing} aria-label="Mengetik">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </div>
              ) : null}
              {error ? (
                <div className={cn(styles.row, styles.rowAssistant)}>
                  <div className={styles.bubbleError}>Gagal membalas. Coba lagi.</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.composerDock}>
            <div className={styles.composerWrap}>
              <form
                className={styles.composer}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitDraft();
                }}
              >
                <textarea
                  ref={inputRef}
                  className={styles.composerField}
                  value={draft}
                  rows={1}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    resizeComposer(event.target);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;

                    if (event.shiftKey) {
                      const el = event.currentTarget;
                      const continued = continueListOnEnter(
                        el.value,
                        el.selectionStart,
                        el.selectionEnd,
                      );
                      if (!continued) return;
                      event.preventDefault();
                      setDraft(continued.next);
                      requestAnimationFrame(() => {
                        el.selectionStart = continued.cursor;
                        el.selectionEnd = continued.cursor;
                        resizeComposer(el);
                      });
                      return;
                    }

                    event.preventDefault();
                    submitDraft();
                  }}
                  disabled={isLoading || recording}
                />
                <Button
                  type="button"
                  size="icon"
                  variant={recording ? "default" : "ghost"}
                  className={cn(styles.composerMic, recording && styles.composerMicRecording)}
                  aria-label={recording ? "Stop dan kirim pesan suara" : "Rekam pesan suara"}
                  aria-pressed={recording}
                  disabled={isLoading}
                  onClick={() => {
                    void toggleRecording();
                  }}
                >
                  {recording ? (
                    <Square className={styles.actionIcon} aria-hidden />
                  ) : (
                    <Mic className={styles.actionIcon} aria-hidden />
                  )}
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  className={styles.composerSend}
                  aria-label="Kirim pesan"
                  disabled={!draft.trim() || isLoading || recording}
                >
                  <Send className={styles.actionIcon} aria-hidden />
                </Button>
              </form>
              <p className={styles.composerHint}>
                {recording
                  ? "Merekam… klik lagi untuk kirim · Esc batal"
                  : "Enter kirim · Shift+Enter baris baru · Mic untuk suara"}
              </p>
              {voiceError ? <p className={styles.voiceError}>{voiceError}</p> : null}
            </div>
          </div>
        </div>

        <div className={styles.fabWrap}>
          <button
            type="button"
            className={cn(styles.fab, styles.fabLight, showHistory && styles.fabLightActive)}
            aria-label="Riwayat chat"
            aria-pressed={showHistory}
            onClick={() => {
              setShowHistory((prev) => !prev);
              void refreshConversations().catch(() => undefined);
            }}
          >
            <History className={styles.fabIcon} aria-hidden />
          </button>
          <button
            type="button"
            className={cn(styles.fab, styles.fabLight)}
            aria-label="Chat baru"
            disabled={isLoading}
            onClick={() => {
              startNewConversation();
            }}
          >
            <Plus className={styles.fabIcon} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.fab}
            aria-label="Keluar dari chat"
            onClick={close}
          >
            <LogOut className={styles.fabIcon} aria-hidden />
          </button>
        </div>
      </section>
    </div>
  );
}
