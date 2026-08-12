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
    <Card className="min-w-0">
      <CardHeader>
        <SectionTitle title="Email content" />
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="min-w-0">
          <p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">Subject</p>
          <p className="mt-1 break-words text-base font-normal tracking-normal text-foreground">{subject}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">Body</p>
          <pre className="mt-2 max-h-[22rem] overflow-y-auto whitespace-pre-wrap break-words rounded-[2px] border border-border bg-surface-inset p-4 font-sans text-sm leading-6 text-foreground">
            {body}
          </pre>
        </div>
        {attachmentName ? (
          <div className="flex min-w-0 items-center gap-2 rounded-[2px] border border-border bg-surface-inset px-3 py-2.5">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {attachmentUrl ? (
              <a href={attachmentUrl} className="min-w-0 truncate text-sm font-normal text-primary hover:underline">
                {attachmentName}
              </a>
            ) : (
              <span className="min-w-0 truncate text-sm font-normal text-foreground">{attachmentName}</span>
            )}
          </div>
        ) : (
          <p className="text-sm font-normal text-muted-foreground">Tidak ada lampiran.</p>
        )}
      </CardBody>
    </Card>
  );
}
