import styles from "./auth-card.module.css";

import Image from "next/image";
import Link from "next/link";

/** Centered ATM card used by the password pages. */
export function AuthCard({ title, text, back, children }: { title: string; text?: React.ReactNode; back?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image src="/icon/atm-icon-192.png" alt="" width={36} height={36} priority />
          <span>Akaal Team Management</span>
        </div>
        <h1 className={styles.title}>{title}</h1>
        {text ? <p className={styles.text}>{text}</p> : null}
        {children}
        {back ? (
          <Link href={back.href} className={styles.back}>
            ← {back.label}
          </Link>
        ) : null}
      </div>
    </main>
  );
}

export const authCardStyles = styles;
