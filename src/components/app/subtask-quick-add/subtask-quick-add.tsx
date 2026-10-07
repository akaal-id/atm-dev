"use client";

import styles from "./subtask-quick-add.module.css";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const LIST_MARKER = /^\s*(?:[-*•▪◦]|\d+[.)]|\[[ xX]?\])\s*/;

/** "Add subtask" that takes one line or many: each non-empty line becomes a subtask (server splits them). */
export function SubtaskQuickAdd({ taskId }: { taskId: string }) {
  const [value, setValue] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const count = value.split(/\r?\n/).filter((line) => line.replace(LIST_MARKER, "").trim()).length;

  return (
    <form ref={formRef} action="/api/resources/Task_Checklists" method="post" className={styles.form}>
      <input type="hidden" name="task_id" value={taskId} />
      <textarea
        name="title"
        required
        className={styles.input}
        rows={Math.min(8, Math.max(2, value.split("\n").length))}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Ctrl/⌘ + Enter adds everything; plain Enter starts the next subtask.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && count > 0) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        placeholder={"Add subtask — one per line\nPaste a list to add several at once"}
        aria-label="Add subtasks, one per line"
      />
      <div className={styles.footer}>
        <span className={styles.hint}>{count > 1 ? `${count} subtasks · ` : ""}Enter = new line · Ctrl/⌘ + Enter = add</span>
        <Button type="submit" variant="default" size="lg" disabled={count === 0}>
          <Plus className={styles.icon} aria-hidden />
          {count > 1 ? `Add ${count} subtasks` : "Add"}
        </Button>
      </div>
    </form>
  );
}
