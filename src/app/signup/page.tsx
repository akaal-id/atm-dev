import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth";

import { SignupFields } from "./signup-fields";
import { SignupForm } from "./signup-form";
import styles from "./signup.module.css";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const appleEnabled = Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET);

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
        <p className={styles.eyebrow}>Request access</p>
        <h1 className={styles.title}>Create your Akaal Team Management account</h1>
        <p className={styles.text}>
          Ajukan akses sebagai karyawan. Masukkan Organization ID, pilih company, lalu department. Admin akan menyetujui
          dan mengirim verification key.
        </p>

        {params.error === "exists" ? <div className={styles.error}>An active account already exists for this email.</div> : null}
        {params.error === "missing" ? <div className={styles.error}>Please fill in all required fields before submitting.</div> : null}
        {params.error === "password" ? <div className={styles.error}>Use a password with at least 8 characters.</div> : null}
        {params.error === "mismatch" ? <div className={styles.error}>Password and confirm password must match.</div> : null}
        {params.error === "invalid" ? <div className={styles.error}>Please check your signup details and try again.</div> : null}
        {params.error === "upload" ? (
          <div className={styles.error}>
            Profile photo upload failed. Use a JPG, PNG, WebP, GIF, or HEIC image under 5MB, or leave the photo empty and try again.
          </div>
        ) : null}
        {params.error === "server" ? (
          <div className={styles.error}>We could not save your request right now. Please try again in a moment.</div>
        ) : null}
        {params.error === "oauth_email" ? <div className={styles.error}>Your social account did not provide an email address.</div> : null}

        {googleEnabled || appleEnabled ? (
          <div className={styles.socialGrid}>
            {googleEnabled ? <Link className={styles.socialButton} href="/api/auth/signin/google">Continue with Google</Link> : null}
            {appleEnabled ? <Link className={styles.socialButton} href="/api/auth/signin/apple">Continue with Apple</Link> : null}
          </div>
        ) : null}

        <SignupForm>
          <SignupFields />
        </SignupForm>

        <p className={styles.footerText}>
          Already verified? <Link href="/login">Sign in</Link>
        </p>
        <p className={styles.footerText}>
          <Link href="/signup/organization">Register as organization owner</Link>
        </p>
      </section>
    </main>
  );
}
