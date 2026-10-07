"use client";

import styles from "./numbered-pager.module.css";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 1 … 4 5 6 … 20: always the first, last, and the current page's neighbours. */
function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) out.push("gap");
    out.push(value);
  });
  return out;
}

/** Prev · numbered pages · Next. Renders nothing for a single page. */
export function NumberedPager({ page, pageCount, onPageChange, label = "Pages" }: { page: number; pageCount: number; onPageChange: (page: number) => void; label?: string }) {
  if (pageCount <= 1) return null;

  return (
    <nav className={styles.pager} aria-label={label}>
      <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        <ChevronLeft className={styles.icon} aria-hidden />
        Prev
      </Button>
      <div className={styles.pages}>
        {pageWindow(page, pageCount).map((value, index) =>
          value === "gap" ? (
            <span key={`gap-${index}`} className={styles.gap} aria-hidden>
              …
            </span>
          ) : (
            <button
              key={value}
              type="button"
              className={value === page ? styles.pageOn : styles.page}
              onClick={() => onPageChange(value)}
              aria-current={value === page ? "page" : undefined}
              aria-label={`Page ${value}`}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
        Next
        <ChevronRight className={styles.icon} aria-hidden />
      </Button>
    </nav>
  );
}
