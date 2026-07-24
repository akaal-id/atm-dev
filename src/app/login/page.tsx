import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/app/login-form";
import { isLegacyWorkspacePath, safeNextPath } from "@/lib/auth-routes";
import { getCurrentUser } from "@/lib/server/auth";
import { getActiveCompanyContext } from "@/lib/server/company-context";
import { buildTenantPath, DEFAULT_COMPANY_ID, DEFAULT_ORG_ID, isTenantPath } from "@/lib/tenant-path";
import styles from "./login.module.css";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; verified?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const appleEnabled = Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET);
  const nextPath = safeNextPath(params.next);

  if (user) {
    if (isTenantPath(nextPath) || nextPath === "/billing") {
      redirect(nextPath);
    }
    try {
      const context = await getActiveCompanyContext(user.user_id);
      const tenant = {
        orgId: context.organization?.id || context.company.organization_id || DEFAULT_ORG_ID,
        companyId: context.company.id || DEFAULT_COMPANY_ID,
      };
      if (isLegacyWorkspacePath(nextPath) || nextPath === "/dashboard") {
        redirect(buildTenantPath({ ...tenant, path: nextPath }));
      }
      redirect(buildTenantPath({ ...tenant, path: "/dashboard" }));
    } catch {
      redirect(buildTenantPath({ orgId: DEFAULT_ORG_ID, companyId: DEFAULT_COMPANY_ID, path: "/dashboard" }));
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.brand}>
          <Image
            src="/icon/mono-akaal-white.png"
            alt="Akaal"
            width={40}
            height={40}
            className={styles.logoMark}
            priority
          />
          <div>
            <p className={styles.brandName}>Akaal Team</p>
            <p className={styles.brandSubtext}>Internal operating system</p>
          </div>
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Work, people, attendance</p>
          <h1 className={styles.heroTitle}>Run the team from one calm command center.</h1>
          <p className={styles.heroText}>
            Tasks, HR profiles, leave approvals, calendar signals, announcements, notifications, and gamification — stitched into one fast PWA.
          </p>
        </div>
        <div className={styles.featureRow} aria-label="Stack">
          {["RBAC", "Supabase", "PWA Ready"].map((item, index) => (
            <span key={item} className={styles.featureItem}>
              {index > 0 ? <span className={styles.featureSep} aria-hidden="true">·</span> : null}
              <span>{item}</span>
            </span>
          ))}
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.card}>
          <div className={styles.mobileLogo}>
            <Image
              src="/icon/mono-akaal-white.png"
              alt="Akaal"
              width={36}
              height={36}
              className={styles.logoMarkDark}
              priority
            />
          </div>
          <div className={styles.formIntro}>
            <p className={styles.formEyebrow}>Secure sign in</p>
            <h1 className={styles.formTitle}>Welcome back</h1>
            <p className={styles.formText}>
              {nextPath.startsWith("/email-blast")
                ? "Sign in to open Email Blast. Use your dashboard account — no separate registration."
                : "Use a Google-auth identity in production or the seeded admin login for local setup."}
            </p>
          </div>

          {params.verified ? <div className={styles.success}>Account verified. You can sign in now.</div> : null}
          {params.error ? <div className={styles.error}>Invalid email or password, or your account is not verified yet.</div> : null}

          {googleEnabled || appleEnabled ? (
            <div className={styles.socialGrid}>
              {googleEnabled ? <Link className={styles.socialButton} href="/api/auth/signin/google">Continue with Google</Link> : null}
              {appleEnabled ? <Link className={styles.socialButton} href="/api/auth/signin/apple">Continue with Apple</Link> : null}
            </div>
          ) : null}

          <LoginForm nextPath={nextPath} />

          <p className={styles.requestText}>
            No account yet? <Link href="/signup">Request access</Link> or <Link href="/verify">enter a verification key</Link>.
          </p>
          <p className={styles.requestText}>
            <Link href="/signup/organization">Register as organization owner</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
