import { Paperclip } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";

function SectionTitle({ title }: { title: string }) {
  return <h2 className="min-w-0 truncate text-base font-semibold tracking-normal text-slate-950">{title}</h2>;
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</p>
          <h1 className="mt-1 text-lg font-semibold tracking-normal text-slate-950">{subject}</h1>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Body</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-6 text-slate-700">
            {body}
          </pre>
        </div>
        {attachmentName ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <Paperclip className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            {attachmentUrl ? (
              <a href={attachmentUrl} className="truncate text-sm font-semibold text-blue-600 hover:underline">
                {attachmentName}
              </a>
            ) : (
              <span className="truncate text-sm font-semibold text-slate-800">{attachmentName}</span>
            )}
          </div>
        ) : (
          <p className="text-sm font-medium text-slate-400">Tidak ada lampiran.</p>
        )}
      </CardBody>
    </Card>
  );
}
