"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmailBlastRecipientStatusBadge } from "@/components/app/email-blast/email-blast-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import type { MockBlastRecipient } from "@/lib/data/email-blast-mock";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-normal tracking-normal text-foreground">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function isFailedRecipient(status: MockBlastRecipient["status"]) {
  return ["failed", "bounced", "complained", "suppressed", "canceled"].includes(status);
}

interface EmailBlastRecipientsListProps {
  recipients: MockBlastRecipient[];
}

/** Per-recipient delivery status table for blast detail, with pagination. */
export function EmailBlastRecipientsList({ recipients }: EmailBlastRecipientsListProps) {
  const [page, setPage] = useState(1);
  const failedCount = useMemo(
    () => recipients.filter((recipient) => isFailedRecipient(recipient.status)).length,
    [recipients],
  );

  const pageCount = Math.max(1, Math.ceil(recipients.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRecipients = recipients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [recipients]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <SectionTitle
          title="Recipients"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {failedCount > 0 ? (
                <Badge tone="red">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                  {failedCount} failed
                </Badge>
              ) : null}
              <Badge tone="blue">{recipients.length}</Badge>
            </div>
          }
        />
      </CardHeader>
      <CardBody className="p-0">
        {recipients.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm font-normal text-muted-foreground">
            Tidak ada penerima pada kiriman ini.
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  {["Email", "Status"].map((header) => (
                    <th key={header} className="border-b border-border px-3 py-3 font-normal text-muted-foreground">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRecipients.map((recipient) => {
                  const failed = isFailedRecipient(recipient.status);
                  return (
                    <tr key={recipient.id} className={cn(failed ? "bg-red-50/70" : "hover:bg-surface-inset/80")}>
                      <td className="border-b border-border px-3 py-3 align-middle">
                        <div className="flex min-w-0 items-center gap-2">
                          {failed ? (
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-label="Delivery failed" />
                          ) : null}
                          <span
                            className={cn(
                              "min-w-0 truncate font-normal",
                              failed ? "text-red-900" : "text-foreground",
                            )}
                          >
                            {recipient.email}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 align-middle">
                        <EmailBlastRecipientStatusBadge status={recipient.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
      <Pagination
        page={currentPage}
        pageCount={pageCount}
        totalItems={recipients.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </Card>
  );
}
