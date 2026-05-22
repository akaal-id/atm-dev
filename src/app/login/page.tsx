import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth";
import styles from "./login.module.css";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; verified?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const appleEnabled = Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET);

  if (user) redirect(params.next || "/dashboard");

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.brand}>
          <div className={styles.logoDark}>ATM</div>
          <div>
            <p className={styles.brandName}>Akaal Team Management</p>
            <p className={styles.brandSubtext}>Internal operating system</p>
          </div>
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Work, people, attendance, and performance</p>
          <h1 className={styles.heroTitle}>Run the team from one calm command center.</h1>
          <p className={styles.heroText}>
            Tasks, HR profiles, leave approvals, calendar signals, announcements, notifications, and gamification are stitched into one fast PWA.
          </p>
        </div>
        <div className={styles.featureGrid}>
          {["RBAC", "Supabase", "PWA Ready"].map((item) => (
            <div key={item} className={styles.feature}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.card}>
          <div className={styles.mobileLogo}>
            <div className={styles.logoLight}>ATM</div>
          </div>
          <div className={styles.formIntro}>
            <p className={styles.formEyebrow}>Secure sign in</p>
            <h1 className={styles.formTitle}>Welcome back</h1>
            <p className={styles.formText}>Use a Google-auth identity in production or the seeded admin login for local setup.</p>
          </div>

          {params.verified ? <div className={styles.success}>Account verified. You can sign in now.</div> : null}
          {params.error ? <div className={styles.error}>Invalid email or password, or your account is not verified yet.</div> : null}

          {googleEnabled || appleEnabled ? (
            <div className={styles.socialGrid}>
              {googleEnabled ? <Link className={styles.socialButton} href="/api/auth/signin/google">Continue with Google</Link> : null}
              {appleEnabled ? <Link className={styles.socialButton} href="/api/auth/signin/apple">Continue with Apple</Link> : null}
            </div>
          ) : null}

          <form action="/api/auth/login" method="post" className={styles.form}>
            <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input name="email" type="email" defaultValue="" required className="input" autoComplete="email" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Password</span>
              <input name="password" type="password" required className="input" autoComplete="current-password" />
            </label>
            <button className={styles.submit}>Sign in</button>
          </form>

          <p className={styles.requestText}>
            No account yet? <Link href="/signup">Request access</Link> or <Link href="/verify">enter a verification key</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
