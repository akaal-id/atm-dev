import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth";
import { listResource } from "@/lib/server/store";
import { PasswordField } from "./password-field";
import styles from "./signup.module.css";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const appleEnabled = Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET);
  const departments = await listResource("Departments");

  if (user) redirect("/dashboard");

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logo}>ATM</div>
        <p className={styles.eyebrow}>Request access</p>
        <h1 className={styles.title}>Create your Akaal Team Management account</h1>
        <p className={styles.text}>After you submit this request, an admin can approve it and email you a verification key.</p>

        {params.error === "exists" ? <div className={styles.error}>An active account already exists for this email.</div> : null}
        {params.error === "invalid" ? <div className={styles.error}>Please check your signup details and use a password with at least 8 characters.</div> : null}
        {params.error === "upload" ? <div className={styles.error}>Profile photo upload failed. Please use a JPG, PNG, WebP, or GIF under 5MB.</div> : null}
        {params.error === "oauth_email" ? <div className={styles.error}>Your social account did not provide an email address.</div> : null}

        {googleEnabled || appleEnabled ? (
          <div className={styles.socialGrid}>
            {googleEnabled ? <Link className={styles.socialButton} href="/api/auth/signin/google">Continue with Google</Link> : null}
            {appleEnabled ? <Link className={styles.socialButton} href="/api/auth/signin/apple">Continue with Apple</Link> : null}
          </div>
        ) : null}

        <form action="/api/auth/signup" method="post" encType="multipart/form-data" className={styles.form}>
          <label className={styles.field}>
            <span>
              Full name <b className={styles.requiredMark}>*</b>
            </span>
            <input name="full_name" required className="input" autoComplete="name" />
          </label>
          <label className={styles.field}>
            <span>
              Email <b className={styles.requiredMark}>*</b>
            </span>
            <input name="email" type="email" required className="input" autoComplete="email" />
          </label>
          <PasswordField name="password" label="Password" autoComplete="new-password" required />
          <PasswordField name="confirm_password" label="Confirm password" autoComplete="new-password" required />
          <label className={styles.field}>
            <span>Profile photo</span>
            <input name="profile_photo" type="url" className="input" placeholder="https://..." />
            <input name="profile_photo_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="input" />
          </label>
          <label className={styles.field}>
            <span>Phone</span>
            <input name="phone" className="input" autoComplete="tel" />
          </label>
          <label className={styles.field}>
            <span>
              Department <b className={styles.requiredMark}>*</b>
            </span>
            <select name="department_id" required className="input" defaultValue="">
              <option value="" disabled>Select department</option>
              {departments.map((department) => (
                <option key={department.department_id} value={department.department_id}>
                  {department.department_name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>
              Birth date <b className={styles.requiredMark}>*</b>
            </span>
            <input name="birthday" type="date" required className="input" />
          </label>
          <label className={styles.field}>
            <span>
              Join date <b className={styles.requiredMark}>*</b>
            </span>
            <input name="join_date" type="date" required className="input" />
          </label>
          <label className={styles.fieldWide}>
            <span>Bio</span>
            <textarea name="bio" className="input" rows={4} placeholder="Tell the team a little about your role or background." />
          </label>
          <button className={styles.submit}>Request account</button>
        </form>

        <p className={styles.footerText}>
          Already verified? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
