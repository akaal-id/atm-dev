"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmailBlastDetailView } from "@/components/app/email-blast/email-blast-detail-view";
import { buttonVariants } from "@/components/ui/button";
import type { MockEmailBlast } from "@/lib/data/email-blast-mock";
import { cn } from "@/lib/utils";

function mapBlast(row: unknown): MockEmailBlast | null {
  if (!row || typeof row !== "object") return null;
  const blast = row as {
    id: string;
    subject: string;
    body: string;
    attachment_url?: string;
    created_at: string;
    recipients?: Array<{ id: string; email: string; status: string }>;
  };
  if (!blast.id) return null;
  return {
    id: blast.id,
    subject: blast.subject,
    body: blast.body,
    attachmentName: blast.attachment_url ? blast.attachment_url.split("/").pop() || "attachment" : null,
    attachmentUrl: blast.attachment_url || null,
    createdAt: blast.created_at,
    recipients: (blast.recipients || []).map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
      status: (["sent", "delivered", "bounced", "failed", "pending"].includes(recipient.status)
        ? recipient.status
        : recipient.status === "skipped"
          ? "pending"
          : "sent") as MockEmailBlast["recipients"][number]["status"],
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
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Memuat detail blast…
      </div>
    );
  }

  if (!blast) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-950">Blast tidak ditemukan</p>
        <p className="text-sm text-slate-600">Data blast mungkin sudah dihapus atau ID tidak valid.</p>
        <Link href="/email-blast/history" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10")}>
          Kembali ke history
        </Link>
      </div>
    );
  }

  return <EmailBlastDetailView blast={blast} />;
}
