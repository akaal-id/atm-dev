import { AlertTriangle } from "lucide-react";

import { EmailBlastRecipientStatusBadge } from "@/components/app/email-blast/email-blast-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { MockBlastRecipient } from "@/lib/data/email-blast-mock";
import { cn } from "@/lib/utils";

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-semibold tracking-normal text-slate-950">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function isFailedRecipient(status: MockBlastRecipient["status"]) {
  return status === "failed" || status === "bounced";
}

interface EmailBlastRecipientsListProps {
  recipients: MockBlastRecipient[];
}

/** Per-recipient delivery status list for blast detail. */
export function EmailBlastRecipientsList({ recipients }: EmailBlastRecipientsListProps) {
  const failedCount = recipients.filter((recipient) => isFailedRecipient(recipient.status)).length;

  return (
    <Card>
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
      <CardBody className="space-y-2">
        {recipients.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-sm font-medium text-slate-500">
            Tidak ada penerima pada kiriman ini.
          </p>
        ) : (
          recipients.map((recipient) => {
            const failed = isFailedRecipient(recipient.status);
            return (
              <div
                key={recipient.id}
                className={cn(
                  "flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                  failed
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-white",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {failed ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-label="Delivery failed" />
                  ) : null}
                  <span
                    className={cn(
                      "min-w-0 truncate text-sm font-medium",
                      failed ? "text-red-900" : "text-slate-800",
                    )}
                  >
                    {recipient.email}
                  </span>
                </div>
                <EmailBlastRecipientStatusBadge status={recipient.status} />
              </div>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
