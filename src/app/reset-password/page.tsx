import styles from "./reset-password.module.css";

import Link from "next/link";

import { AuthCard, authCardStyles } from "@/components/app/auth-card";
import { PasswordForm } from "@/components/app/password-form";
import { checkResetToken } from "@/lib/server/password-reset";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const account = token ? await checkResetToken(token).catch(() => null) : null;

  return (
    <div className={styles.page}>
      {account ? (
        <AuthCard title="Choose a new password" text={`For ${account.email}. You'll be signed out everywhere and can sign in with the new password.`}>
          <PasswordForm requireCurrent={false} resetToken={token} />
        </AuthCard>
      ) : (
        <AuthCard title="This link can't be used" text="Reset links work once and expire after 1 hour." back={{ href: "/login", label: "Back to sign in" }}>
          <Link href="/forgot-password" className={authCardStyles.cta}>
            Send me a new link
          </Link>
        </AuthCard>
      )}
    </div>
  );
}
