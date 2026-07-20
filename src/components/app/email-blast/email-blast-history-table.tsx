"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { EmailBlastHistoryEmpty } from "@/components/app/email-blast/email-blast-history-empty";
import { EmailBlastStatusBadge } from "@/components/app/email-blast/email-blast-status-badge";
import { blastOverallStatus, type MockEmailBlast } from "@/lib/data/email-blast-mock";
import { formatDate } from "@/lib/utils";

const HEADERS = ["Subject", "Sent at", "Recipients", "Attachment", "Status", ""] as const;

interface EmailBlastHistoryTableProps {
  blasts: MockEmailBlast[];
}

/** Reusable table for email blast send history — rows navigate to detail. */
export function EmailBlastHistoryTable({ blasts }: EmailBlastHistoryTableProps) {
  const router = useRouter();

  if (blasts.length === 0) {
    return <EmailBlastHistoryEmpty />;
  }

  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {HEADERS.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-500"
              >
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
                className="cursor-pointer transition hover:bg-slate-50/80 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200"
                onClick={() => router.push(href)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <td className="border-b border-slate-100 px-3 py-3 align-middle">
                  <Link
                    href={href}
                    className="font-semibold text-slate-950 transition hover:text-blue-600"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {blast.subject}
                  </Link>
                  <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-400">{blast.body}</p>
                </td>
                <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 align-middle text-slate-600">
                  {formatDate(blast.createdAt, { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="border-b border-slate-100 px-3 py-3 align-middle font-mono tabular-nums text-slate-700">
                  {blast.recipients.length}
                </td>
                <td className="max-w-40 truncate border-b border-slate-100 px-3 py-3 align-middle text-slate-600">
                  {blast.attachmentName ?? "—"}
                </td>
                <td className="border-b border-slate-100 px-3 py-3 align-middle">
                  <EmailBlastStatusBadge status={blastOverallStatus(blast)} />
                </td>
                <td className="border-b border-slate-100 px-3 py-3 align-middle text-slate-400">
                  <ChevronRight className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Open detail</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
