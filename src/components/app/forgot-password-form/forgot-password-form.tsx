"use client";

import styles from "./forgot-password-form.module.css";

import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Asks for a reset link. The answer is the same whether or not the email has an account. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className={styles.sent} role="status">
        <MailCheck aria-hidden />
        <div>
          <p className={styles.sentTitle}>Check your inbox</p>
          <p className={styles.sentText}>If this email has an ATM account, a reset link is on its way:</p>
          <p className={styles.sentEmail}>{email}</p>
          <p className={styles.sentText}>It expires in 1 hour — check spam if you don&apos;t see it. If nothing arrives, ask an admin to reset your password.</p>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input className="input" type="email" required autoComplete="email" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@akaal.id" />
      </label>
      <Button type="submit" size="xl" disabled={busy || !email.includes("@")}>
        {busy ? <Loader2 className={styles.spin} aria-hidden /> : null}
        Send reset link
      </Button>
    </form>
  );
}
