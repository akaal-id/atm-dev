"use client";

import styles from "./email-blast-recipients-list.module.css";

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
    <div className={styles.title}>
      <h2 className={styles.heading}>{title}</h2>
      {action ? <div className={styles.region}>{action}</div> : null}
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
    <Card className={styles.card}>
      <CardHeader>
        <SectionTitle
          title="Recipients"
          action={
            <div className={styles.header}>
              {failedCount > 0 ? (
                <Badge tone="red">
                  <AlertTriangle className={styles.icon} aria-hidden />
                  {failedCount} failed
                </Badge>
              ) : null}
              <Badge tone="blue">{recipients.length}</Badge>
            </div>
          }
        />
      </CardHeader>
      <CardBody className={styles.body}>
        {recipients.length === 0 ? (
          <p className={styles.emptyText}>
            Tidak ada penerima pada kiriman ini.
          </p>
        ) : (
          <div className={styles.emptyText}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {["Email", "Status"].map((header) => (
                    <th key={header} className={styles.headercell}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRecipients.map((recipient) => {
                  const failed = isFailedRecipient(recipient.status);
                  return (
                    <tr key={recipient.id} className={cn(failed ? styles.group : "hover:bg-surface-inset/80")}>
                      <td className={styles.cell}>
                        <div className={styles.block}>
                          {failed ? (
                            <AlertTriangle className={styles.iconAlerttriangle} aria-label="Delivery failed" />
                          ) : null}
                          <span
                            className={cn(
                              styles.deliveryFailed,
                              failed ? styles.failedNote : styles.deliveryFailedDeliveryFailed,
                            )}
                          >
                            {recipient.email}
                          </span>
                        </div>
                      </td>
                      <td className={styles.whitespacenowrap}>
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
