"use client";

import { ExternalLink, FileText, ListTodo } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import type { ChatMessageView } from "@/lib/types/chat";
import { cn } from "@/lib/utils";

function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function MessageBubble({
  message,
  isOwn,
  showAuthor,
}: {
  message: ChatMessageView;
  isOwn: boolean;
  showAuthor: boolean;
}) {
  if (message.type === "system") {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{stripHtml(message.content)}</span>
      </div>
    );
  }

  const authorName = message.author?.full_name ?? "Unknown";

  return (
    <div className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      <div className="w-8 shrink-0">
        {showAuthor && !isOwn ? <Avatar name={authorName} image={message.author?.profile_photo} size="sm" /> : null}
      </div>

      <div className={cn("flex max-w-[78%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
        {showAuthor && !isOwn ? <span className="px-1 text-xs font-normal text-muted-foreground">{authorName}</span> : null}

        <div
          className={cn(
            "rounded-[2px] px-3 py-2 text-sm shadow-sm",
            isOwn ? "bg-primary text-white" : "bg-card text-foreground ring-1 ring-border",
            message.pending && "opacity-60",
          )}
        >
          {message.content ? (
            <div
              className="chat-prose break-words [&_a]:underline [&_p]:m-0 [&_p+p]:mt-1"
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          ) : null}

          {message.type === "file" && message.file_url ? (
            <FileCard url={message.file_url} name={message.file_name ?? "Attachment"} isOwn={isOwn} />
          ) : null}

          {message.task ? <TaskCard task={message.task} /> : null}

          {message.link_preview ? <LinkCard preview={message.link_preview} isOwn={isOwn} /> : null}

          <div className={cn("mt-1 flex items-center gap-1 text-[10px]", isOwn ? "text-primary-foreground/80" : "text-muted-foreground")}>
            <span>{timeLabel(message.created_at)}</span>
            {message.pending ? <span>· sending…</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function FileCard({ url, name, isOwn }: { url: string; name: string; isOwn: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "mt-1 flex items-center gap-2 rounded-[2px] px-2 py-2 text-sm transition",
        isOwn ? "bg-primary-subtle0/40 hover:bg-primary-subtle0/60" : "bg-surface-inset hover:bg-muted",
      )}
    >
      <FileText className="h-5 w-5 shrink-0" />
      <span className="truncate">{name}</span>
      <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
}

function TaskCard({ task }: { task: NonNullable<ChatMessageView["task"]> }) {
  return (
    <Link
      href={`/tasks/${task.task_id}`}
      className="mt-1 block rounded-[2px] border border-border bg-card p-3 text-foreground no-underline transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-normal uppercase tracking-wide text-primary">
        <ListTodo className="h-3.5 w-3.5" />
        Task
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
          {task.status}
        </span>
      </div>
      <p className="mt-1 line-clamp-1 text-sm font-normal">{task.title}</p>
      {task.description ? (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{stripHtml(task.description)}</p>
      ) : null}
    </Link>
  );
}

function LinkCard({ preview, isOwn }: { preview: NonNullable<ChatMessageView["link_preview"]>; isOwn: boolean }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "mt-1 block overflow-hidden rounded-[2px] no-underline transition",
        isOwn ? "bg-primary-subtle0/30 hover:bg-primary-subtle0/50" : "border border-border bg-card hover:border-border",
      )}
    >
      {preview.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.image} alt="" className="h-32 w-full object-cover" />
      ) : null}
      <div className="p-2.5">
        <p className={cn("text-[10px] font-normal uppercase tracking-wide", isOwn ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {preview.siteName}
        </p>
        {preview.title ? (
          <p className={cn("mt-0.5 line-clamp-1 text-sm font-normal", isOwn ? "text-white" : "text-foreground")}>
            {preview.title}
          </p>
        ) : null}
        {preview.description ? (
          <p className={cn("mt-0.5 line-clamp-2 text-xs", isOwn ? "text-primary-foreground/90" : "text-muted-foreground")}>
            {preview.description}
          </p>
        ) : null}
      </div>
    </a>
  );
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
