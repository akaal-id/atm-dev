"use client";

import styles from "./email-blast-history-table.module.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import { EmailBlastHistoryEmpty } from "@/components/app/email-blast/email-blast-history-empty";
import { EmailBlastStatusBadge } from "@/components/app/email-blast/email-blast-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { blastOverallStatus, type MockEmailBlast } from "@/lib/data/email-blast-mock";
import { cn, formatDate } from "@/lib/utils";

const HEADERS = ["Subject", "Sent at", "Created by", "Recipients", "Attachment", "Status", "Actions"] as const;

interface EmailBlastHistoryTableProps {
  blasts: MockEmailBlast[];
  /** True when the filtered list is empty (not just the current page). */
  empty?: boolean;
}

/** Reusable table for email blast send history — rows navigate to detail. */
export function EmailBlastHistoryTable({ blasts, empty = false }: EmailBlastHistoryTableProps) {
  const router = useRouter();

  if (empty || blasts.length === 0) {
    return <EmailBlastHistoryEmpty />;
  }

  return (
    <div className={styles.emptystate}>
      <table className={styles.table}>
        <thead>
          <tr>
            {HEADERS.map((header) => (
              <th key={header} className={styles.headercell}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blasts.map((blast) => {
            const href = `/email-blast/history/${blast.id}`;
            return (
              <tr
                key={blast.id}
                role="link"
                tabIndex={0}
                className={styles.filterBar}
                onClick={() => router.push(href)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <td className={styles.cell}>
                  <Link
                    href={href}
                    className={styles.link}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {blast.subject}
                  </Link>
                  <p className={styles.itemMeta}>{blast.body}</p>
                </td>
                <td className={styles.whitespacenowrap}>
                  {formatDate(blast.createdAt, { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className={styles.tableCell}>
                  {blast.createdBy?.fullName ? `Created by ${blast.createdBy.fullName}` : "—"}
                </td>
                <td className={styles.cellTd}>
                  {blast.recipients.length}
                </td>
                <td className={styles.cellPrimary}>
                  {blast.attachmentName ?? "—"}
                </td>
                <td className={styles.cell}>
                  <EmailBlastStatusBadge status={blastOverallStatus(blast)} />
                </td>
                <td className={styles.cell}>
                  <div className={styles.group}>
                    <Link
                      href={href}
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), styles.item)}
                      aria-label={`View blast ${blast.subject}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Eye className={styles.filterbarEye} />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
