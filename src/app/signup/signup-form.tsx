"use client";

import { type FormEvent, type ReactNode, useState } from "react";

import styles from "./signup.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignupFormProps {
  children: ReactNode;
}

/** Access request form with client-side mock validation before the real signup API. */
export function SignupForm({ children }: SignupFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const fullName = String(data.get("full_name") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirm_password") ?? "");
    const departmentId = String(data.get("department_id") ?? "").trim();
    const birthday = String(data.get("birthday") ?? "").trim();
    const joinDate = String(data.get("join_date") ?? "").trim();

    if (!fullName) {
      setClientError("Nama lengkap wajib diisi.");
      return;
    }
    if (!email || !EMAIL_PATTERN.test(email)) {
      setClientError("Masukkan alamat email yang valid.");
      return;
    }
    if (password.length < 8) {
      setClientError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setClientError("Password dan konfirmasi harus sama.");
      return;
    }
    if (!departmentId || !birthday || !joinDate) {
      setClientError("Lengkapi department, tanggal lahir, dan tanggal bergabung.");
      return;
    }

    setClientError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        body: data,
      });

      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }

      if (response.ok) {
        window.location.assign("/signup/requested");
        return;
      }

      window.location.assign("/signup?error=server");
    } catch {
      window.location.assign("/signup?error=server");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {clientError ? <div className={styles.error}>{clientError}</div> : null}
      {children}
    </form>
  );
}
