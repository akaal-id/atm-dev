"use client";

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
        class: "chat-prose min-h-[40px] max-h-40 overflow-y-auto px-3 py-2 text-sm outline-none [&_p]:m-0",
      },
      handleKeyDown: (_view, event) => {
        // Enter sends, Shift+Enter inserts a newline.
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          submitText();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
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
      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white focus-within:border-blue-400">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-l-2xl text-slate-500 transition hover:text-slate-900 disabled:opacity-50"
            aria-label="Attach file"
          >
            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={() => setTaskPickerOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center text-slate-500 transition hover:text-blue-600"
            aria-label="Attach task"
          >
            <ListTodo className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <EditorContent editor={editor} />
          </div>

          <button
            type="button"
            onClick={submitText}
            className="m-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700"
            aria-label="Send message"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>

        {isUploading ? (
          <div className="mt-2 space-y-1" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-slate-500">
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
                className="inline-flex items-center gap-1 text-slate-500 transition hover:text-red-600"
                aria-label="Cancel upload"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-150"
                style={{ width: `${status === "uploading" ? progress : status === "finalizing" ? 100 : 8}%` }}
              />
            </div>
          </div>
        ) : null}

        {error && !isUploading ? (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
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
