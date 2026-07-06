import { MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { akaalHub, leaderInitials, whatsappUrl } from "@/lib/data/akaal-hub";
import styles from "@/app/hub.module.css";

export function HubPage() {
  const { brand, leaders, socials } = akaalHub;

  return (
    <main className={styles.page}>
      <div className={styles.gridBg} aria-hidden="true" />
      <div className={styles.ambient} aria-hidden="true">
        <div className={`${styles.orb} ${styles.orb1}`} />
        <div className={`${styles.orb} ${styles.orb2}`} />
        <div className={`${styles.orb} ${styles.orb3}`} />
        <div className={styles.footerGlow} />
      </div>

      <div className={styles.shell}>
        <header className={`${styles.brand} ${styles.reveal}`}>
          <a
            href={brand.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.logoLink}
            aria-label={`${brand.name} — visit akaal.id`}
          >
            <Image
              src={brand.logoSrc}
              alt={brand.name}
              width={120}
              height={32}
              className={styles.logo}
              priority
            />
          </a>
          <p className={styles.eyebrow}>Connect with us</p>
          <p className={styles.tagline}>{brand.tagline}</p>
          <a
            href={brand.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.websiteBtn}
          >
            Visit akaal.id
            <svg
              className={styles.btnArrow}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </a>
        </header>

        <div className={`${styles.leaders} ${styles.reveal} ${styles.revealDelay1}`}>
          {leaders.map((leader) => {
            const firstName = leader.name.split(" ")[0];
            return (
              <article key={leader.whatsapp} className={styles.leaderCard}>
                <div className={styles.leaderTop}>
                  <div className={styles.avatar} aria-hidden="true">
                    {leaderInitials(leader.name)}
                  </div>
                  <div className={styles.leaderMeta}>
                    <p className={styles.leaderRole}>{leader.role}</p>
                    <h2 className={styles.leaderName}>{leader.name}</h2>
                  </div>
                </div>
                <a
                  href={whatsappUrl(leader.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.whatsappBtn}
                >
                  <MessageCircle className={styles.btnIcon} aria-hidden />
                  Message {firstName}
                  <svg
                    className={styles.btnArrow}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </a>
              </article>
            );
          })}
        </div>

        {socials.length > 0 ? (
          <section className={`${styles.connect} ${styles.reveal} ${styles.revealDelay2}`} aria-label="Social links">
            <p className={styles.connectLabel}>Also find us on</p>
            <nav className={styles.socials}>
              {socials.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                >
                  {social.label}
                </a>
              ))}
            </nav>
          </section>
        ) : null}

        <footer className={`${styles.footer} ${styles.reveal} ${styles.revealDelay3}`}>
          <Link href="/login" className={styles.teamLogin}>
            Team login
          </Link>
        </footer>
      </div>
    </main>
  );
}
