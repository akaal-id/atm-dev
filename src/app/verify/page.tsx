import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/server/auth";
import styles from "../signup/signup.module.css";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (user) redirect("/dashboard");

  return (
    <main className={styles.page}>
      <section className={styles.cardCompact}>
        <div className={styles.logo}>ATM</div>
        <p className={styles.eyebrow}>Verify access</p>
        <h1 className={styles.title}>Enter your verification key</h1>
        <p className={styles.text}>Use the key sent to your email after admin approval. Then you can sign in with the password you created.</p>

        {params.error === "expired" ? <div className={styles.error}>This verification key expired. Ask an admin to approve again for a new key.</div> : null}
        {params.error && params.error !== "expired" ? <div className={styles.error}>The email or verification key is not valid.</div> : null}

        <form action="/api/auth/verify" method="post" className={styles.formSingle}>
          <label className={styles.field}>
            <span>Email</span>
            <input name="email" type="email" required className="input" autoComplete="email" />
          </label>
          <label className={styles.field}>
            <span>Verification key</span>
            <input name="verification_key" required className="input" inputMode="numeric" autoComplete="one-time-code" />
          </label>
          <Button type="submit" size="lg" className={styles.submit}>
            Verify account
          </Button>
        </form>

        <p className={styles.footerText}>
          Need an account? <Link href="/signup">Request access</Link>
        </p>
      </section>
    </main>
  );
}
