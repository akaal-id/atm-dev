"use client";

import styles from "./pagination.module.css";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/** Prev/next pager with an item-range summary, meant to sit under a table. */
export function Pagination({ page, pageCount, totalItems, pageSize, onPageChange }: PaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className={styles.pagination}>
      <p className={styles.paginationRoot}>
        Menampilkan {start}–{end} dari {totalItems}
      </p>
      <div className={styles.group}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className={styles.halamanSebelumnya} />
        </Button>
        <span className={styles.prevPage}>
          Halaman {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className={styles.halamanSebelumnya} />
        </Button>
      </div>
    </div>
  );
}
