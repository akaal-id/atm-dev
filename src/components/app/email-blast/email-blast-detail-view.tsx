import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EmailBlastContentCard } from "@/components/app/email-blast/email-blast-content-card";
import { EmailBlastRecipientsList } from "@/components/app/email-blast/email-blast-recipients-list";
import { EmailBlastStatusBadge } from "@/components/app/email-blast/email-blast-status-badge";
import { Page } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { blastOverallStatus, type MockEmailBlast } from "@/lib/data/email-blast-mock";
import { cn, formatDate } from "@/lib/utils";

interface EmailBlastDetailViewProps {
  blast: MockEmailBlast;
}

/** Detail view for a single company-shared blast. */
export function EmailBlastDetailView({ blast }: EmailBlastDetailViewProps) {
  const overall = blastOverallStatus(blast);
  const deliveredCount = blast.recipients.filter((r) =>
    ["delivered", "sent", "opened", "clicked"].includes(r.status),
  ).length;
  const issueCount = blast.recipients.filter((r) =>
    ["bounced", "failed", "complained", "suppressed", "canceled"].includes(r.status),
  ).length;

  const meta = [
    {
      label: "Sent at",
      value: formatDate(blast.createdAt, { hour: "2-digit", minute: "2-digit" }),
    },
    {
      label: "Created by",
      value: blast.createdBy?.fullName || "—",
    },
    {
      label: "Recipients",
      value: <Badge tone="neutral">{blast.recipients.length}</Badge>,
    },
    {
      label: "Delivered / sent",
      value: <Badge tone="green">{deliveredCount}</Badge>,
    },
    {
      label: "Issues",
      value: <Badge tone={issueCount > 0 ? "red" : "neutral"}>{issueCount}</Badge>,
    },
  ] as const;

  return (
    <Page>
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/email-blast/history"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to history
            </Link>
            <EmailBlastStatusBadge status={overall} />
          </div>
          <h1 className="text-lg font-normal tracking-normal text-foreground break-words">{blast.subject}</h1>
        </CardHeader>
        <CardBody className="border-t border-border">
          <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            {meta.map((item) => (
              <div key={item.label} className="min-w-0 space-y-1.5">
                <dt className="text-xs font-normal uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                <dd className="min-w-0 text-sm font-normal text-foreground [&_*]:max-w-full">{item.value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-start">
        <EmailBlastContentCard
          subject={blast.subject}
          body={blast.body}
          attachmentName={blast.attachmentName}
          attachmentUrl={blast.attachmentUrl}
        />
        <EmailBlastRecipientsList recipients={blast.recipients} />
      </div>
    </Page>
  );
}
