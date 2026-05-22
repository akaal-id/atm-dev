import Link from "next/link";
import styles from "./offline.module.css";

export default function OfflinePage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logo}>ATM</div>
        <h1 className={styles.title}>You are offline</h1>
        <p className={styles.text}>Cached pages remain available. Reconnect to sync team data, comments, attendance, and notifications.</p>
        <Link href="/dashboard" className={styles.link}>
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
