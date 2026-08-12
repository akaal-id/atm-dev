import { cn } from "@/lib/utils";

import styles from "./page-layout.module.css";

/** Standard workspace page stack — keeps content inside the viewport on mobile. */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(styles.page, className)}>{children}</div>;
}

/** Horizontal scroll row for kanban lanes (fixed lane width at every breakpoint). */
export function ScrollRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(styles.scrollRow, className)}>{children}</div>;
}
