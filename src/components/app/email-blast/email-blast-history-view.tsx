import Link from "next/link";
import { History, Plus } from "lucide-react";

import { EmailBlastHistoryTable } from "@/components/app/email-blast/email-blast-history-table";
import { Page } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { MockEmailBlast } from "@/lib/data/email-blast-mock";
import { cn } from "@/lib/utils";

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-semibold tracking-normal text-slate-950">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

interface EmailBlastHistoryViewProps {
  blasts: MockEmailBlast[];
}

/** Send history list backed by mock data until the API is ready. */
export function EmailBlastHistoryView({ blasts }: EmailBlastHistoryViewProps) {
  return (
    <Page>
      <Card>
        <CardHeader>
          <SectionTitle
            title="Send history"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">
                  <History className="mr-1 inline h-3.5 w-3.5" />
                  {blasts.length} blasts
                </Badge>
                <Link href="/email-blast" className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-10")}>
                  <Plus className="h-4 w-4" />
                  Compose
                </Link>
              </div>
            }
          />
        </CardHeader>
        <CardBody>
          <EmailBlastHistoryTable blasts={blasts} />
        </CardBody>
      </Card>
    </Page>
  );
}
