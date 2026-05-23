"use client";

import { type FormEvent, type ReactNode, useState } from "react";

import styles from "./signup.module.css";

interface SignupFormProps {
  children: ReactNode;
}

export function SignupForm({ children }: SignupFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        body: new FormData(event.currentTarget),
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
    <form className={styles.form} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
