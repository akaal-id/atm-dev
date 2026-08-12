"use client";

import styles from "./email-blast-resend-key-form.module.css";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className={styles.title}>
      <h2 className={styles.heading}>{title}</h2>
      {action ? <div className={styles.emptyText}>{action}</div> : null}
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
      <CardBody className={styles.body}>
        <p className={styles.emptyText}>
          Email Blast memakai <code className={styles.code}>RESEND_API_KEY</code>{" "}
          dari environment server ATM — sama dengan notifikasi & onboarding. Tidak perlu input key di UI.
        </p>

        <div
          className={
            data?.configured
              ? styles.icon
              : styles.section
          }
          role="status"
        >
          {loading ? <Loader2 className={styles.spinner} /> : null}
          {!loading && data?.configured ? <CheckCircle2 className={styles.iconPrimary} /> : null}
          {!loading && !data?.configured ? <XCircle className={styles.iconPrimary} /> : null}
          <span>
            {loading
              ? "Memeriksa status…"
              : data
                ? `${data.message}${data.from_email ? ` From: ${data.from_email}` : ""}`
                : "Status tidak tersedia."}
          </span>
        </div>

        <Button type="button" variant="outline" size="lg" className={styles.button} disabled={loading} onClick={() => void refresh()}>
          {loading ? "Checking…" : "Refresh status"}
        </Button>
      </CardBody>
    </Card>
  );
}
