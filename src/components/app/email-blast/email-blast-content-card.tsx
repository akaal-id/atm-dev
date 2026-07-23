import { Paperclip } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";

function SectionTitle({ title }: { title: string }) {
  return <h2 className="min-w-0 truncate text-base font-normal tracking-normal text-foreground">{title}</h2>;
}

interface EmailBlastContentCardProps {
  subject: string;
  body: string;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
}

/** Read-only display of blast subject, body, and optional attachment. */
export function EmailBlastContentCard({
  subject,
  body,
  attachmentName = null,
  attachmentUrl = null,
}: EmailBlastContentCardProps) {
  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Email content" />
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">Subject</p>
          <h1 className="mt-1 text-lg font-normal tracking-normal text-foreground">{subject}</h1>
        </div>
        <div>
          <p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">Body</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-[2px] border border-border bg-surface-inset p-4 font-sans text-sm leading-6 text-foreground">
            {body}
          </pre>
        </div>
        {attachmentName ? (
          <div className="flex items-center gap-2 rounded-[2px] border border-border bg-card px-3 py-2.5">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {attachmentUrl ? (
              <a href={attachmentUrl} className="truncate text-sm font-normal text-primary hover:underline">
                {attachmentName}
              </a>
            ) : (
              <span className="truncate text-sm font-normal text-neutral-800">{attachmentName}</span>
            )}
          </div>
        ) : (
          <p className="text-sm font-normal text-muted-foreground">Tidak ada lampiran.</p>
        )}
      </CardBody>
    </Card>
  );
}
