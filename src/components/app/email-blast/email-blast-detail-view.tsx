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

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-normal tracking-normal text-foreground">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

interface EmailBlastDetailViewProps {
  blast: MockEmailBlast;
}

/** Detail view for a single blast — mock data until API is ready. */
export function EmailBlastDetailView({ blast }: EmailBlastDetailViewProps) {
  const overall = blastOverallStatus(blast);
  const deliveredCount = blast.recipients.filter((r) => r.status === "delivered" || r.status === "sent").length;
  const issueCount = blast.recipients.filter((r) => r.status === "bounced" || r.status === "failed").length;

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/email-blast/history" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10")}>
          <ArrowLeft className="h-4 w-4" />
          Back to history
        </Link>
        <EmailBlastStatusBadge status={overall} />
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <EmailBlastContentCard
          subject={blast.subject}
          body={blast.body}
          attachmentName={blast.attachmentName}
          attachmentUrl={blast.attachmentUrl}
        />

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <SectionTitle title="Summary" />
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-normal text-muted-foreground">Sent at</span>
                <span className="font-normal text-foreground">
                  {formatDate(blast.createdAt, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-normal text-muted-foreground">Recipients</span>
                <Badge tone="neutral">{blast.recipients.length}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-normal text-muted-foreground">Delivered / sent</span>
                <Badge tone="green">{deliveredCount}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-normal text-muted-foreground">Issues</span>
                <Badge tone={issueCount > 0 ? "red" : "neutral"}>{issueCount}</Badge>
              </div>
            </CardBody>
          </Card>

          <EmailBlastRecipientsList recipients={blast.recipients} />
        </div>
      </div>
    </Page>
  );
}
