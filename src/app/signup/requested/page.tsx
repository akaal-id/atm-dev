import Link from "next/link";

import styles from "../signup.module.css";

export default function SignupRequestedPage() {
  return (
    <main className={styles.page}>
      <section className={styles.cardCompact}>
        <div className={styles.logo}>ATM</div>
        <p className={styles.eyebrow}>Request sent</p>
        <h1 className={styles.title}>Your account request is waiting for admin approval.</h1>
        <p className={styles.text}>You will get an email after the admin approves your request. That email includes the verification key for account activation.</p>
        <div className={styles.actions}>
          <Link className={styles.submitLink} href="/verify">Enter verification key</Link>
          <Link className={styles.secondaryLink} href="/login">Back to login</Link>
        </div>
      </section>
    </main>
  );
}
