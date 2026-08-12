"use client";

import { useEffect, useState } from "react";

import { EmailBlastHistoryView } from "@/components/app/email-blast/email-blast-history-view";
import { normalizeRecipientStatus, type MockEmailBlast } from "@/lib/data/email-blast-mock";

function mapBlasts(rows: unknown[]): MockEmailBlast[] {
  return rows.map((entry) => {
    const blast = entry as {
      id: string;
      subject: string;
      body: string;
      attachment_url?: string;
      attachment_name?: string;
      created_at: string;
      created_by?: { user_id?: string; full_name?: string };
      recipients?: Array<{ id: string; email: string; status: string }>;
    };
    return {
      id: blast.id,
      subject: blast.subject,
      body: blast.body,
      attachmentName: blast.attachment_name || (blast.attachment_url ? "attachment" : null),
      attachmentUrl: blast.attachment_url || null,
      createdAt: blast.created_at,
      createdBy: blast.created_by?.user_id
        ? {
            userId: blast.created_by.user_id,
            fullName: blast.created_by.full_name || blast.created_by.user_id,
          }
        : undefined,
      recipients: (blast.recipients || []).map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        status: normalizeRecipientStatus(recipient.status),
      })),
    };
  });
}

export function EmailBlastHistoryLoader() {
  const [blasts, setBlasts] = useState<MockEmailBlast[]>([]);

  useEffect(() => {
    void fetch("/api/email-blast/history", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => setBlasts(mapBlasts(Array.isArray(body?.data) ? body.data : [])))
      .catch(() => setBlasts([]));
  }, []);

  return <EmailBlastHistoryView blasts={blasts} />;
}
