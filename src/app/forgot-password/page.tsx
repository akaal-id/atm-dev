import styles from "./forgot-password.module.css";

import { AuthCard } from "@/components/app/auth-card";
import { ForgotPasswordForm } from "@/components/app/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className={styles.page}>
      <AuthCard title="Forgot your password?" text="Enter your work email. We'll send you a link to choose a new password." back={{ href: "/login", label: "Back to sign in" }}>
        <ForgotPasswordForm />
      </AuthCard>
    </div>
  );
}
