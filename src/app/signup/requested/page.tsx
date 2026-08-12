import Image from "next/image";
import Link from "next/link";

import styles from "./requested.module.css";

export default async function SignupRequestedPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  const isOrgOwner = params.type === "org_owner";

  return (
    <main className={styles.page}>
      <section className={styles.cardCompact}>
        <Image
          src="/icon/mono-akaal-white.png"
          alt="Akaal"
          width={36}
          height={36}
          className={styles.logoMark}
          priority
        />
        {isOrgOwner ? (
          <>
            <p className={styles.eyebrow}>Organization ready</p>
            <h1 className={styles.title}>Organisasi kamu sudah dibuat.</h1>
            <p className={styles.text}>
              Akun Organization Owner aktif. Login, lalu selesaikan pembayaran bulanan (dummy) agar perusahaan ter-verified
              dan dashboard ERP terbuka.
            </p>
            <div className={styles.actions}>
              <Link className={styles.submitLink} href="/login">
                Sign in &amp; continue to billing
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className={styles.eyebrow}>Request sent</p>
            <h1 className={styles.title}>Your account request is waiting for admin approval.</h1>
            <p className={styles.text}>
              You will get an email after the admin approves your request. That email includes the verification key for
              account activation.
            </p>
            <div className={styles.actions}>
              <Link className={styles.submitLink} href="/verify">
                Enter verification key
              </Link>
              <Link className={styles.secondaryLink} href="/login">
                Back to login
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
