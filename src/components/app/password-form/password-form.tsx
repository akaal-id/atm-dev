"use client";

import styles from "./password-form.module.css";

import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const MIN = 8;

function PasswordInput({ label, value, onChange, autoComplete, autoFocus }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string; autoFocus?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputWrap}>
        <input className="input" type={shown ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} required />
        <button type="button" className={styles.toggle} onClick={() => setShown((current) => !current)} aria-label={shown ? "Hide password" : "Show password"}>
          {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      </span>
    </label>
  );
}

/**
 * Change-password form. `requireCurrent` is false right after an admin reset.
 * With `resetToken` it completes an emailed "forgot password" link instead (signed out).
 */
export function PasswordForm({ requireCurrent, resetToken }: { requireCurrent: boolean; resetToken?: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const longEnough = next.length >= MIN;
  const matches = next.length > 0 && next === confirm;
  const valid = longEnough && matches && (!requireCurrent || current.length > 0);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(resetToken ? "/api/auth/reset-password" : "/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resetToken ? { token: resetToken, newPassword: next } : { currentPassword: current, newPassword: next }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Could not change the password.");
      setDone(true);
      window.setTimeout(() => window.location.assign(resetToken ? "/login?reset=1" : "/dashboard"), 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not change the password.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className={styles.success} role="status">
        <Check aria-hidden /> Password updated. {resetToken ? "Taking you to sign in…" : "Taking you to ATM…"}
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {requireCurrent ? <PasswordInput label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus /> : null}
      <PasswordInput label="New password" value={next} onChange={setNext} autoComplete="new-password" autoFocus={!requireCurrent} />
      <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <ul className={styles.rules}>
        <li className={longEnough ? styles.ok : undefined}>At least {MIN} characters</li>
        <li className={matches ? styles.ok : undefined}>Both new passwords match</li>
      </ul>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="xl" disabled={!valid || busy}>
        {busy ? <Loader2 className={styles.spin} aria-hidden /> : null}
        Save new password
      </Button>
    </form>
  );
}
