import styles from "./password.module.css";

import Image from "next/image";
import Link from "next/link";

import { PasswordForm } from "@/components/app/password-form";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function AccountPasswordPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const user = await requireUser();
  const required = Boolean(user.must_change_password) || (await searchParams).required === "1";
  const oauth = user.signup_provider === "google" || user.signup_provider === "apple";

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image src="/icon/atm-icon-192.png" alt="" width={36} height={36} priority />
          <span>Akaal Team Management</span>
        </div>
        <h1 className={styles.title}>{required ? "Set a new password" : "Change password"}</h1>
        <p className={styles.text}>
          {required
            ? `Hi ${user.full_name.split(" ")[0]}, your password was reset by an admin. Choose a new one to continue.`
            : "Signed in as " + user.email + ". Other devices will be signed out."}
        </p>
        {oauth ? (
          <p className={styles.notice}>This account signs in with {user.signup_provider === "google" ? "Google" : "Apple"} and has no ATM password.</p>
        ) : (
          <PasswordForm requireCurrent={!user.must_change_password} />
        )}
        {required ? null : (
          <Link href="/dashboard" className={styles.back}>
            ← Back to ATM
          </Link>
        )}
      </div>
    </main>
  );
}
