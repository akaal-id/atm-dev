"use client";

import styles from "./ai-assistant-widget.module.css";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  AlarmClockOff,
  ArrowRight,
  BadgeCheck,
  Ban,
  Bot,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  FilePenLine,
  History,
  Hourglass,
  ListTodo,
  MessageCircle,
  PlayCircle,
  Plus,
  Send,
  Sparkles,
  TimerOff,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import { statusTone } from "@/components/ui/status-pill";
import type { AiConversationSummary } from "@/lib/types/ai-chat";
import type { Priority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type TaskListItem = {
  task_id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string;
  is_due_today: boolean;
  is_overdue: boolean;
};

type AiChatMessage = UIMessage<
  never,
  never,
  {
    getMyTasks: {
      input: Record<string, never>;
      output: TaskListItem[];
    };
    rememberFact: {
      input: { key: string; value: string };
      output: { ok: boolean; key: string; value: string; factCount: number };
    };
  }
>;

/** One distinct icon per workflow status. Overdue is a separate badge icon, not a replacement. */
function statusIcon(status: TaskStatus): LucideIcon {
  switch (status) {
    case "To Do":
      return ListTodo;
    case "In Progress":
      return PlayCircle;
    case "Waiting Approval":
      return Hourglass;
    case "Ready":
      return CircleCheck;
    case "Finished":
      return CheckCircle2;
    case "Need Revision":
      return FilePenLine;
    case "Approved":
      return BadgeCheck;
    case "Done":
      return CheckCheck;
    case "Late":
      return TimerOff;
    case "Cancelled":
      return Ban;
    case "Overdue":
      return AlarmClockOff;
    default:
      return ListTodo;
  }
}

function formatDueDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

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
        <ol key={key++} className={styles.mdList} start={items[0]?.n ?? 1}>
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

export function AiAssistantWidget() {
  const panelId = useId();
  // Stable across conversation switches — avoids useChat's id-keyed message
  // store racing with setMessages() when loadConversation() swaps both in
  // the same render cycle. conversationId (below) still tracks which
  // conversation is active for the sidebar highlight and API requests.
  const chatSessionId = useId();
  const pathname = usePathname();
  const { href: tenantHref } = useTenant();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("Chat baru");
  const [bootstrapping, setBootstrapping] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const transport = useRef(
    new DefaultChatTransport<AiChatMessage>({
      api: "/api/ai/chat",
      prepareSendMessagesRequest: ({ messages, id, body }) => ({
        body: {
          ...body,
          id,
          messages,
          conversationId: conversationIdRef.current,
          pagePath: pathnameRef.current,
        },
      }),
    }),
  ).current;

  const { messages, sendMessage, setMessages, status, error } = useChat<AiChatMessage>({
    id: chatSessionId,
    transport,
  });
  const isLoading = status === "submitted" || status === "streaming";

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
    setConversationId(json.data.conversation.conversation_id);
    setConversationTitle(json.data.conversation.title || "Chat baru");
    setMessages(json.data.messages ?? []);
    setShowHistory(false);
  }

  async function startNewConversation() {
    const response = await fetch("/api/ai/conversations", { method: "POST" });
    if (!response.ok) throw new Error("Gagal membuat chat baru.");
    const json = (await response.json()) as { data: AiConversationSummary };
    setConversationId(json.data.conversation_id);
    setConversationTitle(json.data.title || "Chat baru");
    setMessages([]);
    setShowHistory(false);
    setConversations((prev) => [json.data, ...prev.filter((row) => row.conversation_id !== json.data.conversation_id)]);
  }

  async function bootstrapSession() {
    setBootstrapping(true);
    setHistoryError(null);
    try {
      const list = await refreshConversations();
      if (list[0]) {
        await loadConversation(list[0].conversation_id);
      } else {
        await startNewConversation();
      }
    } catch (err) {
      console.error(err);
      setHistoryError("Riwayat chat belum siap. Coba lagi nanti.");
    } finally {
      setBootstrapping(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void bootstrapSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only bootstrap when drawer opens
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [open, messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, conversationId]);

  function close() {
    setOpen(false);
    setShowHistory(false);
  }

  function submitDraft() {
    const text = draft.trim();
    if (!text || isLoading || !conversationId || bootstrapping) return;
    sendMessage({ text });
    setDraft("");
    setConversationTitle((prev) => (prev === "Chat baru" ? text.slice(0, 60) : prev));
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      resizeComposer(el);
    });
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
        await startNewConversation();
      }
    }
  }

  return (
    <>
      {!open ? (
        <div className={styles.fabWrap}>
          <button
            type="button"
            className={styles.fab}
            aria-label="Buka asisten ATM"
            aria-expanded={false}
            aria-controls={panelId}
            onClick={() => setOpen(true)}
          >
            <MessageCircle className={styles.fabIcon} aria-hidden />
          </button>
        </div>
      ) : null}

      {open ? (
        <div className={styles.layer}>
          <section
            id={panelId}
            className={styles.room}
            role="dialog"
            aria-modal="true"
            aria-label="Asisten ATM"
          >
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Tutup riwayat"
                  onClick={() => setShowHistory(false)}
                >
                  <X className={styles.actionIcon} aria-hidden />
                </Button>
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
                <div className={styles.topBarSide}>
                  <Button
                    type="button"
                    variant={showHistory ? "default" : "ghost"}
                    size="icon"
                    aria-label="Riwayat chat"
                    aria-pressed={showHistory}
                    disabled={bootstrapping}
                    onClick={() => {
                      setShowHistory((prev) => !prev);
                      void refreshConversations().catch(() => undefined);
                    }}
                  >
                    <History className={styles.actionIcon} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Chat baru"
                    disabled={bootstrapping || isLoading}
                    onClick={() => {
                      void startNewConversation().catch(() => setHistoryError("Gagal membuat chat baru."));
                    }}
                  >
                    <Plus className={styles.actionIcon} aria-hidden />
                  </Button>
                </div>
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
                  {!bootstrapping && !historyError && messages.length === 0 ? (
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
                            disabled={isLoading || bootstrapping || !conversationId}
                            onClick={() => {
                              if (!conversationId || isLoading || bootstrapping) return;
                              sendMessage({ text: prompt });
                              setConversationTitle((prev) =>
                                prev === "Chat baru" ? prompt.slice(0, 60) : prev,
                              );
                            }}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {bootstrapping ? (
                    <div className={cn(styles.row, styles.rowAssistant)}>
                      <div className={styles.assistantMark} aria-hidden>
                        <Bot className={styles.assistantMarkIcon} />
                      </div>
                      <div className={cn(styles.bubble, styles.bubbleAssistant)}>
                        <span className={styles.typing}>
                          <span />
                          <span />
                          <span />
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {historyError && !bootstrapping ? (
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
                            return (
                              <div
                                key={`${message.id}-text-${index}`}
                                className={cn(
                                  styles.bubble,
                                  message.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
                                )}
                              >
                                {renderMessageContent(part.text)}
                              </div>
                            );
                          }

                          if (part.type === "tool-getMyTasks") {
                            return (
                              <TaskToolResult
                                key={part.toolCallId}
                                part={part}
                                hrefFor={(taskId) => tenantHref(`/tasks/${taskId}`)}
                                onNavigate={close}
                                onSendPrompt={(promptText) => {
                                  if (!isLoading && conversationId && !bootstrapping) {
                                    sendMessage({ text: promptText });
                                  }
                                }}
                              />
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
                    placeholder="Tanyakan apa saja…"
                    aria-label="Pesan asisten"
                    autoComplete="off"
                    disabled={isLoading || bootstrapping || !conversationId}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className={styles.composerSend}
                    aria-label="Kirim pesan"
                    disabled={!draft.trim() || isLoading || bootstrapping || !conversationId}
                  >
                    <Send className={styles.actionIcon} aria-hidden />
                  </Button>
                </form>
                <p className={styles.composerHint}>Enter kirim · Shift+Enter baris baru</p>
              </div>
            </div>

            <div className={styles.fabWrap}>
              <button
                type="button"
                className={styles.fab}
                aria-label="Tutup chat"
                onClick={close}
              >
                <X className={styles.fabIcon} aria-hidden />
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function TaskToolResult({
  part,
  hrefFor,
  onNavigate,
  onSendPrompt,
}: {
  part: Extract<AiChatMessage["parts"][number], { type: "tool-getMyTasks" }>;
  hrefFor: (taskId: string) => string;
  onNavigate: () => void;
  onSendPrompt: (promptText: string) => void;
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  if (part.state === "input-streaming" || part.state === "input-available") {
    return <div className={styles.taskLoading}>Memuat task…</div>;
  }

  if (part.state === "output-error") {
    return <div className={styles.taskEmpty}>Gagal memuat task.</div>;
  }

  if (part.state !== "output-available") return null;

  const tasks = part.output ?? [];
  if (tasks.length === 0) {
    return <div className={styles.taskEmpty}>Tidak ada task aktif.</div>;
  }

  return (
    <div className={styles.taskPanel}>
      <div className={styles.taskPanelHeader}>
        <ListTodo className={styles.taskPanelHeaderIcon} aria-hidden />
        <span className={styles.taskPanelHeaderLabel}>
          {tasks.length} task aktif
        </span>
      </div>

      <ul className={styles.taskList}>
        {tasks.map((task) => {
          const Icon = statusIcon(task.status);
          const tone = statusTone(task.status);
          const statusLabel = task.is_overdue ? `${task.status} · Overdue` : task.status;
          const isExpanded = expandedTaskId === task.task_id;
          const dueLabel = task.is_overdue
            ? "Overdue"
            : task.is_due_today
              ? "Due hari ini"
              : formatDueDate(task.due_date);

          return (
            <li
              key={task.task_id}
              className={cn(styles.taskItem, isExpanded && styles.taskItemExpanded)}
            >
              <div className={styles.taskCardHeader}>
                <button
                  type="button"
                  className={styles.taskCard}
                  onClick={() =>
                    setExpandedTaskId((prev) => (prev === task.task_id ? null : task.task_id))
                  }
                  title={statusLabel}
                  aria-expanded={isExpanded}
                  aria-label={`${task.title}, status ${statusLabel}`}
                >
                  <span className={cn(styles.taskIcon, toneClass(tone))} aria-hidden>
                    <Icon className={styles.taskIconSvg} />
                  </span>

                  <span className={styles.taskBody}>
                    <span className={styles.taskTitle}>{task.title}</span>
                    <span className={styles.taskMeta}>
                      <span className={cn(styles.taskStatus, toneClass(tone))}>{task.status}</span>
                      {dueLabel ? (
                        <span
                          className={cn(
                            styles.taskDue,
                            task.is_overdue && styles.taskDueOverdue,
                            task.is_due_today && !task.is_overdue && styles.taskDueToday,
                          )}
                        >
                          {dueLabel}
                        </span>
                      ) : null}
                      {task.priority ? (
                        <span className={styles.taskPriority}>{task.priority}</span>
                      ) : null}
                    </span>
                  </span>

                  <span className={styles.expandIcon} aria-hidden>
                    {isExpanded ? (
                      <ChevronDown className={styles.taskChevron} />
                    ) : (
                      <ChevronRight className={styles.taskChevron} />
                    )}
                  </span>
                </button>

                <Link
                  href={hrefFor(task.task_id)}
                  className={styles.taskLinkBtn}
                  onClick={onNavigate}
                  title="Buka detail halaman task"
                  aria-label={`Buka detail ${task.title}`}
                >
                  <ExternalLink className={styles.taskLinkIcon} aria-hidden />
                </Link>
              </div>

              {isExpanded ? (
                <div className={styles.taskActions}>
                  <p className={styles.taskActionsLabel}>Aksi cepat</p>
                  <div className={styles.actionGrid}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() =>
                        onSendPrompt(
                          `Saya ingin meng-update status atau progres untuk task #${task.task_id}: "${task.title}". Tolong tanyakan detail perubahan yang perlu di-update.`,
                        )
                      }
                    >
                      <Bot className={styles.actionBtnIcon} />
                      <span>Update</span>
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() =>
                        onSendPrompt(
                          `Saya ingin mengedit detail (judul, deskripsi, priority, atau deadline) untuk task #${task.task_id}: "${task.title}". Tolong tanyakan bagian mana yang ingin diubah.`,
                        )
                      }
                    >
                      <Sparkles className={styles.actionBtnIcon} />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() =>
                        onSendPrompt(
                          `Tolong bantu buatkan breakdown sub-task / checklist baru untuk task #${task.task_id}: "${task.title}".`,
                        )
                      }
                    >
                      <CheckSquare className={styles.actionBtnIcon} />
                      <span>Sub-task</span>
                    </button>

                    <button
                      type="button"
                      className={cn(styles.actionBtn, styles.actionBtnPrimary)}
                      onClick={() =>
                        onSendPrompt(
                          `Bantu saya meninjau task #${task.task_id} "${task.title}". Apa rekomendasi atau langkah selanjutnya untuk task ini?`,
                        )
                      }
                    >
                      <ArrowRight className={styles.actionBtnIcon} />
                      <span>Rekomendasi</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function toneClass(tone: ReturnType<typeof statusTone>) {
  switch (tone) {
    case "blue":
      return styles.toneBlue;
    case "green":
      return styles.toneGreen;
    case "yellow":
      return styles.toneYellow;
    case "red":
      return styles.toneRed;
    default:
      return styles.toneNeutral;
  }
}
