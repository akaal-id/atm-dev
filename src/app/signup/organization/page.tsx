import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth";

import { SignupForm } from "../signup-form";
import styles from "../signup.module.css";
import { OrgOwnerSignupFields } from "./org-owner-signup-fields";

export const dynamic = "force-dynamic";

export default async function OrgOwnerSignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (user) redirect("/dashboard");

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Image
          src="/icon/mono-akaal-white.png"
          alt="Akaal"
          width={36}
          height={36}
          className={styles.logoMark}
          priority
        />
        <p className={styles.eyebrow}>Organization owner</p>
        <h1 className={styles.title}>Register your organization</h1>
        <p className={styles.text}>
          Create an organization, register your first company, then activate a monthly subscription to open Akaal Team
          ERP.
        </p>

        {params.error === "exists" ? <div className={styles.error}>An active account already exists for this email.</div> : null}
        {params.error === "missing" ? <div className={styles.error}>Please fill in all required fields before submitting.</div> : null}
        {params.error === "password" ? <div className={styles.error}>Use a password with at least 8 characters.</div> : null}
        {params.error === "mismatch" ? <div className={styles.error}>Password and confirm password must match.</div> : null}
        {params.error === "upload" ? (
          <div className={styles.error}>
            Profile photo upload failed. Use a JPG, PNG, WebP, GIF, or HEIC image under 5MB, or leave the photo empty and try again.
          </div>
        ) : null}
        {params.error === "server" ? (
          <div className={styles.error}>We could not save your request right now. Please try again in a moment.</div>
        ) : null}

        <SignupForm errorRedirect="/signup/organization?error=server">
          <OrgOwnerSignupFields />
        </SignupForm>

        <p className={styles.footerText}>
          Already verified? <Link href="/login">Sign in</Link>
        </p>
        <p className={styles.footerText}>
          Joining an existing company? <Link href="/signup">Request employee access</Link>
        </p>
      </section>
    </main>
  );
}
