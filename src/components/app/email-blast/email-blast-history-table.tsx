"use client";

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
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {HEADERS.map((header) => (
              <th key={header} className="border-b border-border px-3 py-3 font-normal text-muted-foreground">
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
                className="cursor-pointer transition hover:bg-surface-inset/80 focus-visible:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200"
                onClick={() => router.push(href)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <td className="border-b border-border px-3 py-3 align-middle">
                  <Link
                    href={href}
                    className="font-normal text-foreground transition hover:text-primary"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {blast.subject}
                  </Link>
                  <p className="mt-0.5 line-clamp-1 text-xs font-normal text-muted-foreground">{blast.body}</p>
                </td>
                <td className="whitespace-nowrap border-b border-border px-3 py-3 align-middle text-muted-foreground">
                  {formatDate(blast.createdAt, { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="border-b border-border px-3 py-3 align-middle text-muted-foreground">
                  {blast.createdBy?.fullName ? `Created by ${blast.createdBy.fullName}` : "—"}
                </td>
                <td className="border-b border-border px-3 py-3 align-middle font-mono tabular-nums text-foreground">
                  {blast.recipients.length}
                </td>
                <td className="max-w-40 truncate border-b border-border px-3 py-3 align-middle text-muted-foreground">
                  {blast.attachmentName ?? "—"}
                </td>
                <td className="border-b border-border px-3 py-3 align-middle">
                  <EmailBlastStatusBadge status={blastOverallStatus(blast)} />
                </td>
                <td className="border-b border-border px-3 py-3 align-middle">
                  <div className="flex items-center justify-end">
                    <Link
                      href={href}
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
                      aria-label={`View blast ${blast.subject}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Eye className="h-4 w-4" />
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
