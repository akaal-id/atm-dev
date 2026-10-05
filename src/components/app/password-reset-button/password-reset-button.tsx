"use client";

import styles from "./password-reset-button.module.css";

import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/**
 * Admin action on an employee profile: reset to a one-time temporary password.
 * The password is shown once here (never stored in plain text); the employee must change it at next sign-in.
 */
export function PasswordResetButton({ userId, name, blockedReason }: { userId: string; name: string; blockedReason?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const firstName = name.split(" ")[0] || name;

  function close() {
    if (busy) return;
    setOpen(false);
    // Forget the temporary password once the dialog closes.
    setPassword("");
    setError("");
    setCopied(false);
  }

  async function reset() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/reset-password`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { data?: { temporaryPassword?: string }; error?: string } | null;
      if (!response.ok || !body?.data?.temporaryPassword) throw new Error(body?.error || "Could not reset the password.");
      setPassword(body.data.temporaryPassword);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(password).catch(() => null);
    setCopied(true);
  }

  return (
    <div className={styles.root}>
      <div className={styles.text}>
        <p className={styles.title}>Password</p>
        <p className={styles.hint}>{blockedReason ?? `Forgot their password? Give ${firstName} a temporary one; they'll set a new password at next sign-in.`}</p>
      </div>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={Boolean(blockedReason)}>
        <KeyRound className={styles.icon} aria-hidden />
        Reset password
      </Button>

      <Modal open={open} onClose={close} title={password ? "Temporary password" : `Reset ${firstName}'s password?`} eyebrow="Employee" className={styles.panel}>
        {password ? (
          <div className={styles.body}>
            <p className={styles.hint}>Send this to {firstName} privately (e.g. WhatsApp). It is shown only once.</p>
            <div className={styles.secret}>
              <code>{password}</code>
              <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
                {copied ? <Check className={styles.icon} aria-hidden /> : <Copy className={styles.icon} aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <ol className={styles.steps}>
              <li>{firstName} signs in at team.akaal.id with their email and this password.</li>
              <li>ATM asks them to choose a new password right away.</li>
            </ol>
            <div className={styles.actions}>
              <Button type="button" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.body}>
            <p className={styles.hint}>
              {firstName}&apos;s current password stops working and they are signed out on every device. You&apos;ll get a temporary password to send them.
            </p>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button type="button" variant="outline" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => void reset()} disabled={busy}>
                {busy ? <Loader2 className={styles.spin} aria-hidden /> : <KeyRound className={styles.icon} aria-hidden />}
                Reset password
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
