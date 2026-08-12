"use client";

import styles from "./login-form.module.css";

import { useState } from "react";

import { Button } from "@/components/ui/button";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginFormProps {
  nextPath: string;
}

/** Client-side validation before posting to the real login API; honors `next` redirect. */
export function LoginForm({ nextPath }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      event.preventDefault();
      setError("Masukkan alamat email yang valid.");
      return;
    }
    if (!password.trim()) {
      event.preventDefault();
      setError("Password wajib diisi.");
      return;
    }
    setError("");
  }

  return (
    <form action="/api/auth/login" method="post" className={styles.form} onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="next" value={nextPath} />
      {error ? <div className={styles.error}>{error}</div> : null}
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          name="email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError("");
          }}
          required
          className="input"
          autoComplete="email"
          aria-invalid={Boolean(error && error.toLowerCase().includes("email"))}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          name="password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) setError("");
          }}
          required
          className="input"
          autoComplete="current-password"
          aria-invalid={Boolean(error && error.toLowerCase().includes("password"))}
        />
      </label>
      <Button type="submit" size="lg" className={styles.submit}>
        Sign in
      </Button>
    </form>
  );
}
