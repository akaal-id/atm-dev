"use client";

import styles from "./assignee-picker.module.css";

import { Check, ChevronDown, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AssigneeOption = { user_id: string; full_name: string };

/** Compact multi-select for assignees: a chip button that opens a searchable checklist. */
export function AssigneePicker({
  users,
  value,
  onChange,
  emptyLabel = "Me",
  label = "Assignees",
}: {
  users: AssigneeOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Shown when nobody is picked (the server then assigns the creator). */
  emptyLabel?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const names = value.map((id) => users.find((user) => user.user_id === id)?.full_name.split(" ")[0]).filter(Boolean);
  const summary = names.length === 0 ? emptyLabel : names.length <= 2 ? names.join(", ") : `${names[0]} +${names.length - 1}`;
  const needle = query.trim().toLowerCase();
  const visible = users.filter((user) => !needle || user.full_name.toLowerCase().includes(needle));

  function toggle(userId: string) {
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${summary}`}>
        <UserPlus className={styles.icon} aria-hidden />
        <span className={value.length ? styles.value : styles.placeholder}>{summary}</span>
        <ChevronDown className={styles.icon} aria-hidden />
      </button>
      {open ? (
        <div className={styles.popover}>
          {users.length > 8 ? <input className="input" autoFocus placeholder="Search people" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search people" /> : null}
          <ul className={styles.list} role="listbox" aria-multiselectable aria-label={label}>
            {visible.map((user) => {
              const selected = value.includes(user.user_id);
              return (
                <li key={user.user_id}>
                  <button type="button" role="option" aria-selected={selected} className={styles.option} onClick={() => toggle(user.user_id)}>
                    <span className={selected ? styles.boxOn : styles.box}>{selected ? <Check aria-hidden /> : null}</span>
                    {user.full_name}
                  </button>
                </li>
              );
            })}
            {visible.length === 0 ? <li className={styles.none}>No match</li> : null}
          </ul>
          {value.length ? (
            <button type="button" className={styles.clear} onClick={() => onChange([])}>
              Clear ({emptyLabel})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
