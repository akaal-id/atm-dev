import { AuthCard, authCardStyles } from "@/components/app/auth-card";
import { PasswordForm } from "@/components/app/password-form";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function AccountPasswordPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const user = await requireUser();
  const required = Boolean(user.must_change_password) || (await searchParams).required === "1";
  const oauth = user.signup_provider === "google" || user.signup_provider === "apple";

  return (
    <AuthCard
      title={required ? "Set a new password" : "Change password"}
      text={
        required
          ? `Hi ${user.full_name.split(" ")[0]}, your password was reset by an admin. Choose a new one to continue.`
          : `Signed in as ${user.email}. Other devices will be signed out.`
      }
      back={required ? undefined : { href: "/dashboard", label: "Back to ATM" }}
    >
      {oauth ? (
        <p className={authCardStyles.notice}>This account signs in with {user.signup_provider === "google" ? "Google" : "Apple"} and has no ATM password.</p>
      ) : (
        <PasswordForm requireCurrent={!user.must_change_password} />
      )}
    </AuthCard>
  );
}
