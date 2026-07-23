"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-normal tracking-normal text-foreground">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type StatusPayload = {
  configured: boolean;
  status: string;
  from_email: string | null;
  message: string;
};

/** Shows server Resend env status — keys live in ATM env, not per-user storage. */
export function EmailBlastResendKeyForm({
  onFeedback,
}: {
  onFeedback?: (tone: "success" | "error", message: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatusPayload | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/email-blast/resend-status", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Gagal memeriksa status Resend.");
      setData(body.data as StatusPayload);
      onFeedback?.(body.data.configured ? "success" : "error", body.data.message);
    } catch (error) {
      setData(null);
      onFeedback?.("error", error instanceof Error ? error.message : "Gagal memeriksa status Resend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title="Resend API"
          action={
            data?.configured ? (
              <Badge tone="green">Connected</Badge>
            ) : loading ? (
              <Badge tone="blue">Checking</Badge>
            ) : (
              <Badge tone="neutral">Not configured</Badge>
            )
          }
        />
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Email Blast memakai <code className="rounded bg-muted px-1.5 py-0.5 text-xs">RESEND_API_KEY</code>{" "}
          dari environment server ATM — sama dengan notifikasi & onboarding. Tidak perlu input key di UI.
        </p>

        <div
          className={
            data?.configured
              ? "flex items-start gap-2 rounded-[2px] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-normal text-emerald-700"
              : "flex items-start gap-2 rounded-[2px] border border-border bg-surface-inset px-3 py-2.5 text-sm font-normal text-muted-foreground"
          }
          role="status"
        >
          {loading ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : null}
          {!loading && data?.configured ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
          {!loading && !data?.configured ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
          <span>
            {loading
              ? "Memeriksa status…"
              : data
                ? `${data.message}${data.from_email ? ` From: ${data.from_email}` : ""}`
                : "Status tidak tersedia."}
          </span>
        </div>

        <Button type="button" variant="outline" size="lg" className="h-10" disabled={loading} onClick={() => void refresh()}>
          {loading ? "Checking…" : "Refresh status"}
        </Button>
      </CardBody>
    </Card>
  );
}
