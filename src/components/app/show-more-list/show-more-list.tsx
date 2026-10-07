"use client";

import styles from "./show-more-list.module.css";

import { Children, useState } from "react";

/** Renders the first `initial` children, then reveals `step` more per click. Keeps long feeds light on phones. */
export function ShowMoreList({ children, initial = 30, step = 30, noun = "items" }: { children: React.ReactNode; initial?: number; step?: number; noun?: string }) {
  const items = Children.toArray(children);
  const [visible, setVisible] = useState(initial);
  const remaining = items.length - visible;

  return (
    <>
      {items.slice(0, visible)}
      {remaining > 0 ? (
        <button type="button" className={styles.more} onClick={() => setVisible((count) => count + step)}>
          Show {Math.min(step, remaining)} more {noun} · {remaining} left
        </button>
      ) : null}
    </>
  );
}
