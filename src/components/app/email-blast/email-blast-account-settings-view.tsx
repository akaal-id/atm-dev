"use client";

import { useEffect, useState } from "react";

import { EmailBlastResendKeyForm } from "@/components/app/email-blast/email-blast-resend-key-form";
import { EmailBlastSenderNameForm } from "@/components/app/email-blast/email-blast-sender-name-form";
import {
  EmailBlastSettingsFeedback,
  type SettingsFeedback,
} from "@/components/app/email-blast/email-blast-settings-feedback";
import { Page } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/types";
import styles from "./email-blast-account-settings.module.css";

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-base font-semibold tracking-normal text-slate-950">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

interface EmailBlastAccountSettingsViewProps {
  user: CurrentUser;
}

/** Account settings shell for email blast sender identity. */
export function EmailBlastAccountSettingsView({ user }: EmailBlastAccountSettingsViewProps) {
  const [feedback, setFeedback] = useState<SettingsFeedback | null>(null);
  const [senderName, setSenderName] = useState(user.full_name);

  useEffect(() => {
    void fetch("/api/email-blast/sender", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        const name = String(body?.data?.sender_name ?? "").trim();
        if (name) setSenderName(name);
      })
      .catch(() => undefined);
  }, []);

  return (
    <Page>
      {feedback ? (
        <EmailBlastSettingsFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />
      ) : null}

      <div className={styles.layout}>
        <div className={styles.stack}>
          <Card>
            <CardHeader>
              <SectionTitle title="Account settings" action={<Badge tone="blue">{user.role.role_name}</Badge>} />
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">
                Pengaturan akun memakai identitas login dashboard. Atur nama tampilan pengirim dan preferensi blast di sini.
              </p>
              <div className={styles.identityGrid}>
                <div className={styles.identityCard}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in as</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-950">{user.full_name}</p>
                  <p className="mt-0.5 break-all text-sm text-slate-600">{user.email}</p>
                </div>
                <div className={styles.identityCard}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{user.role.role_name}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{user.employment_status || "—"}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <EmailBlastSenderNameForm
            key={senderName}
            defaultName={senderName}
            onSave={setSenderName}
            onFeedback={(tone, message) => setFeedback({ tone, message })}
          />
          <EmailBlastResendKeyForm onFeedback={(tone, message) => setFeedback({ tone, message })} />
        </div>

        <Card className={styles.noteCard}>
          <CardHeader>
            <SectionTitle title="Catatan" />
          </CardHeader>
          <CardBody>
            <p className="text-sm leading-6 text-slate-500">
              Email Blast memakai login dashboard ATM yang sudah ada. Resend memakai{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">RESEND_API_KEY</code> di
              environment server — tidak ada setup auth atau key per-user terpisah.
            </p>
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
