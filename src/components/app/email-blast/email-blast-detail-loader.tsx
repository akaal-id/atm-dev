"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmailBlastDetailView } from "@/components/app/email-blast/email-blast-detail-view";
import { buttonVariants } from "@/components/ui/button";
import { normalizeRecipientStatus, type MockEmailBlast } from "@/lib/data/email-blast-mock";
import { cn } from "@/lib/utils";

function mapBlast(row: unknown): MockEmailBlast | null {
  if (!row || typeof row !== "object") return null;
  const blast = row as {
    id: string;
    subject: string;
    body: string;
    attachment_url?: string;
    attachment_name?: string;
    created_at: string;
    created_by?: { user_id?: string; full_name?: string };
    recipients?: Array<{ id: string; email: string; status: string }>;
  };
  if (!blast.id) return null;
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
}

export function EmailBlastDetailLoader({ id }: { id: string }) {
  const [blast, setBlast] = useState<MockEmailBlast | null | undefined>(undefined);

  useEffect(() => {
    void fetch(`/api/email-blast/history/${id}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          setBlast(null);
          return;
        }
        const body = await response.json().catch(() => null);
        setBlast(mapBlast(body?.data ?? null));
      })
      .catch(() => setBlast(null));
  }, [id]);

  if (blast === undefined) {
    return (
      <div className="rounded-[2px] border border-border bg-card p-6 text-sm text-muted-foreground">
        Memuat detail blast…
      </div>
    );
  }

  if (!blast) {
    return (
      <div className="space-y-3 rounded-[2px] border border-border bg-card p-6">
        <p className="text-sm font-normal text-foreground">Blast tidak ditemukan</p>
        <p className="text-sm text-muted-foreground">Data blast mungkin sudah dihapus atau ID tidak valid.</p>
        <Link href="/email-blast/history" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10")}>
          Kembali ke history
        </Link>
      </div>
    );
  }

  return <EmailBlastDetailView blast={blast} />;
}
