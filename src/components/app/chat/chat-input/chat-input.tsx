"use client";

import styles from "./chat-input.module.css";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ListTodo, Loader2, Paperclip, SendHorizontal, X } from "lucide-react";
import { useRef, useState } from "react";

import { TaskPickerDialog } from "@/components/app/chat/task-picker-dialog";
import { useDriveUpload } from "@/hooks/useDriveUpload";
import type { ChatTaskCard, SendMessageInput } from "@/lib/types/chat";

export type OutgoingMessage = Omit<SendMessageInput, "message_id" | "room_id">;

export function ChatInput({ onSend }: { onSend: (payload: OutgoingMessage) => void }) {
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const { upload, cancel, progress, status, error, isUploading, reset } = useDriveUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false, // required for SSR / React 19 hydration
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Placeholder.configure({ placeholder: "Write a message…  (type /task to attach a task)" }),
    ],
    editorProps: {
      attributes: {
        class: styles.field,
      },
      handleKeyDown: (_view: any, event: any) => {
        // Enter sends, Shift+Enter inserts a newline.
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          submitText();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }: { editor: any }) => {
      // Slash command: typing "/task" opens the picker and clears the input.
      if (editor.getText().trim() === "/task") {
        editor.commands.clearContent();
        setTaskPickerOpen(true);
      }
    },
  });

  function submitText() {
    if (!editor) return;
    const html = editor.getHTML();
    if (editor.isEmpty || !html) return;
    onSend({ type: "text", content: html });
    editor.commands.clearContent();
    editor.commands.focus();
  }

  function attachTask(task: ChatTaskCard) {
    onSend({ type: "task", content: "", task_id: task.task_id });
  }

  async function handleFile(file: File) {
    try {
      const { webViewLink, fileName, fileMime } = await upload(file);
      onSend({ type: "file", content: "", file_url: webViewLink, file_name: fileName, file_mime: fileMime });
      reset();
    } catch (cause) {
      console.error(cause);
      const message = cause instanceof Error ? cause.message : "Upload failed. Please try again.";
      if (!message.includes("cancelled")) {
        alert(message.includes("not configured") ? "Google Drive is not configured. Contact your admin." : message);
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.group}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={styles.button}
            aria-label="Attach file"
          >
            {isUploading ? <Loader2 className={styles.attachFile} /> : <Paperclip className={styles.attachButton} />}
          </button>

          <button
            type="button"
            onClick={() => setTaskPickerOpen(true)}
            className={styles.buttonAlt}
            aria-label="Attach task"
          >
            <ListTodo className={styles.attachButton} />
          </button>

          <div className={styles.content}>
            <EditorContent editor={editor} />
          </div>

          <button
            type="button"
            onClick={submitText}
            className={styles.rowButton}
            aria-label="Send message"
          >
            <SendHorizontal className={styles.sendMessage} />
          </button>
        </div>

        {isUploading ? (
          <div className={styles.sendButton} role="status" aria-live="polite">
            <div className={styles.sendMessageSendMessage}>
              <span>
                {status === "preparing"
                  ? "Preparing upload…"
                  : status === "finalizing"
                    ? "Finalizing…"
                    : `Uploading… ${progress}%`}
              </span>
              <button
                type="button"
                onClick={cancel}
                className={styles.control}
                aria-label="Cancel upload"
              >
                <X className={styles.cancelUpload} />
                Cancel
              </button>
            </div>
            <div className={styles.cancelButton}>
              <div
                className={styles.cancelUploadCancelUpload}
                style={{ width: `${status === "uploading" ? progress : status === "finalizing" ? 100 : 8}%` }}
              />
            </div>
          </div>
        ) : null}

        {error && !isUploading ? (
          <p className={styles.errortext} role="alert">
            {error}
          </p>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          className={styles.input}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>

      <TaskPickerDialog open={taskPickerOpen} onClose={() => setTaskPickerOpen(false)} onSelect={attachTask} />
    </>
  );
}
