"use client";

import styles from "./rich-text-editor.module.css";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Quote } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type ToolbarAction = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const toolbar: ToolbarAction[] = [
  { label: "Heading", icon: Heading2, isActive: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "Subheading", icon: Heading3, isActive: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "Bold", icon: Bold, isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { label: "Italic", icon: Italic, isActive: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: "Bulleted list", icon: List, isActive: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbered list", icon: ListOrdered, isActive: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Quote", icon: Quote, isActive: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
];

/**
 * Tiptap editor with a formatting toolbar; read-only when `editable` is false.
 * `onChange` receives HTML ("" when empty). `toolbarEnd` renders at the right of the toolbar.
 */
export function RichTextEditor({
  content,
  editable,
  onChange,
  placeholder,
  toolbarEnd,
  minHeight = "12rem",
  className,
}: {
  content: string;
  editable: boolean;
  onChange?: (html: string) => void;
  placeholder?: string;
  toolbarEnd?: React.ReactNode;
  minHeight?: string;
  className?: string;
}) {
  const [, forceToolbarUpdate] = useState(0);

  const editor = useEditor({
    immediatelyRender: false, // required for SSR / React 19 hydration
    editable,
    content: content || "",
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: !editable, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    onUpdate: ({ editor: current }) => onChange?.(current.isEmpty ? "" : current.getHTML()),
    onSelectionUpdate: () => forceToolbarUpdate((value) => value + 1),
  });

  return (
    <div className={cn(styles.root, editable && styles.editable, className)} style={{ "--editor-min-height": minHeight } as React.CSSProperties}>
      {editable ? (
        <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
          {toolbar.map((action) => (
            <button
              key={action.label}
              type="button"
              className={cn(styles.tool, editor && action.isActive(editor) && styles.toolActive)}
              onClick={() => editor && action.run(editor)}
              aria-label={action.label}
              aria-pressed={editor ? action.isActive(editor) : false}
              disabled={!editor}
            >
              <action.icon className={styles.toolIcon} />
            </button>
          ))}
          {toolbarEnd ? <div className={styles.toolbarEnd}>{toolbarEnd}</div> : null}
        </div>
      ) : null}
      <EditorContent editor={editor} className={styles.content} />
    </div>
  );
}
