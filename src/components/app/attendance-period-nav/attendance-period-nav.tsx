import styles from "./attendance-period-nav.module.css";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { type HistoryView, jakartaToday, periodRange } from "@/lib/attendance-history";
import { cn, formatDate } from "@/lib/utils";

const views: Array<{ id: HistoryView; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

type PeriodState = { basePath: string; view: HistoryView; anchor: string };

/** URL for a period/page of an attendance list; all state lives in the query string. */
export function periodHref({ basePath, view, anchor }: PeriodState, patch: Partial<{ view: HistoryView; date: string; page: number }> = {}) {
  const params = new URLSearchParams({ view: patch.view ?? view, date: patch.date ?? anchor, page: String(patch.page ?? 1) });
  return `${basePath}?${params.toString()}`;
}

/** Rows for page `page` (1-based, clamped) and the page count. */
export function pageSlice<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page || 1), pages);
  return { current, pages, rows: rows.slice((current - 1) * size, current * size) };
}

/** Day / Week / Month switch with previous / next period and a "Today" shortcut. */
export function AttendancePeriodNav({ state, className }: { state: PeriodState; className?: string }) {
  const { start, end, prev, next } = periodRange(state.view, state.anchor);
  const today = jakartaToday();
  const label = state.view === "day" ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;

  return (
    <div className={cn(styles.toolbar, className)}>
      <div className={styles.segment} role="tablist" aria-label="Period">
        {views.map((option) => (
          <Link
            key={option.id}
            href={periodHref(state, { view: option.id })}
            role="tab"
            aria-selected={option.id === state.view}
            scroll={false}
            className={cn(styles.segmentItem, option.id === state.view && styles.active)}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <div className={styles.nav}>
        <Link href={periodHref(state, { date: prev })} className={styles.navButton} aria-label="Previous period" scroll={false}>
          <ChevronLeft />
        </Link>
        <span className={styles.period}>{label}</span>
        <Link href={periodHref(state, { date: next })} className={styles.navButton} aria-label="Next period" scroll={false}>
          <ChevronRight />
        </Link>
        {start > today || end < today ? (
          <Link href={periodHref(state, { date: today })} className={styles.todayLink} scroll={false}>
            Today
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Numbered page links; renders nothing for a single page. */
export function AttendancePager({ state, current, pages }: { state: PeriodState; current: number; pages: number }) {
  if (pages <= 1) return null;
  return (
    <nav className={styles.pager} aria-label="Pages">
      {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
        <Link
          key={number}
          href={periodHref(state, { page: number })}
          aria-current={number === current ? "page" : undefined}
          scroll={false}
          className={cn(styles.pageLink, number === current && styles.active)}
        >
          {number}
        </Link>
      ))}
    </nav>
  );
}
