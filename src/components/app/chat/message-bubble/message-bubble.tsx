"use client";

import styles from "./message-bubble.module.css";

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
      <div className={styles.messagebubble}>
        <span className={styles.meta}>{stripHtml(message.content)}</span>
      </div>
    );
  }

  const authorName = message.author?.full_name ?? "Unknown";

  return (
    <div className={cn(styles.group, isOwn ? styles.cluster : styles.clusterDiv)}>
      <div className={styles.panel}>
        {showAuthor && !isOwn ? <Avatar name={authorName} image={message.author?.profile_photo} size="sm" /> : null}
      </div>

      <div className={cn(styles.region, isOwn ? styles.itemsend : styles.itemsstart)}>
        {showAuthor && !isOwn ? <span className={styles.caption}>{authorName}</span> : null}

        <div
          className={cn(
            styles.block,
            isOwn ? styles.surface : styles.surfaceDiv,
            message.pending && styles.surfacePrimary,
          )}
        >
          {message.content ? (
            <div
              className={styles.surfaceSecondary}
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          ) : null}

          {message.type === "file" && message.file_url ? (
            <FileCard url={message.file_url} name={message.file_name ?? "Attachment"} isOwn={isOwn} />
          ) : null}

          {message.task ? <TaskCard task={message.task} /> : null}

          {message.link_preview ? <LinkCard preview={message.link_preview} isOwn={isOwn} /> : null}

          <div className={cn(styles.surfaceTertiary, isOwn ? styles.surfaceAlt : styles.surfaceAside)}>
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
        styles.link,
        isOwn ? styles.linkFilecard : styles.linkA,
      )}
    >
      <FileText className={styles.icon} />
      <span className={styles.captionSpan}>{name}</span>
      <ExternalLink className={styles.item} />
    </a>
  );
}

function TaskCard({ task }: { task: NonNullable<ChatMessageView["task"]> }) {
  return (
    <Link
      href={`/tasks/${task.task_id}`}
      className={styles.linkTaskcard}
    >
      <div className={styles.glyph}>
        <ListTodo className={styles.surfaceTaskcard} />
        Task
        <span className={styles.captionTaskcard}>
          {task.status}
        </span>
      </div>
      <p className={styles.itemDescription}>{task.title}</p>
      {task.description ? (
        <p className={styles.text}>{stripHtml(task.description)}</p>
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
        styles.linkTaskcard,
        isOwn ? styles.linkTaskcard : styles.linkTaskcard,
      )}
    >
      {preview.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.image} alt="" className={styles.image} />
      ) : null}
      <div className={styles.surfaceInner}>
        <p className={cn(styles.textP, isOwn ? styles.surfaceAlt : styles.surfaceAside)}>
          {preview.siteName}
        </p>
        {preview.title ? (
          <p className={cn(styles.textPrimary, isOwn ? styles.textSecondary : styles.textTertiary)}>
            {preview.title}
          </p>
        ) : null}
        {preview.description ? (
          <p className={cn(styles.textAlt, isOwn ? styles.textAside : styles.surfaceAside)}>
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
