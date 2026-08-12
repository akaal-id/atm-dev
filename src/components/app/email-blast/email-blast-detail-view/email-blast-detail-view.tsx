import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./email-blast-detail-view.module.css";

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
        <CardHeader className={styles.header}>
          <div className={styles.block}>
            <Link
              href="/email-blast/history"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.link)}
            >
              <ArrowLeft className={styles.surface} />
              Back to history
            </Link>
            <EmailBlastStatusBadge status={overall} />
          </div>
          <h1 className={styles.title}>{blast.subject}</h1>
        </CardHeader>
        <CardBody className={styles.body}>
          <dl className={styles.bodyDl}>
            {meta.map((item) => (
              <div key={item.label} className={styles.item}>
                <dt className={styles.bodyDl}>{item.label}</dt>
                <dd className={styles.content}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <div className={styles.bodyDiv}>
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
