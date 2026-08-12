import { Mail, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import styles from "./hub-page.module.css";

import { akaalHub, whatsappUrl } from "@/lib/data/akaal-hub";

export function HubPage() {
  const { brand, leaders, socials } = akaalHub;

  return (
    <main className={styles.page}>
      <div className={styles.gridBg} aria-hidden="true" />
      <div className={styles.ambient} aria-hidden="true">
        <div className={`${styles.orb} ${styles.hubPageBlock}`} />
        <div className={`${styles.orb} ${styles.orbAlt}`} />
        <div className={`${styles.orb} ${styles.orbDiv}`} />
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

        <div className={`${styles.leaders} ${styles.reveal} ${styles.revealDelay}`}>
          {leaders.map((leader) => (
            <article key={leader.whatsapp} className={styles.bizCard}>
              <div className={styles.bizCardStripe}>
                <Image
                  src={brand.logoLightSrc}
                  alt=""
                  width={320}
                  height={320}
                  className={styles.bizCardLogoBg}
                  aria-hidden
                />
              </div>

              <div className={styles.bizCardBody}>
                <div className={styles.bizCardHeader}>
                  <h2 className={styles.bizCardName}>{leader.name}</h2>
                  <span className={styles.bizCardRolePill}>{leader.roleTitle}</span>
                </div>

                <div className={styles.bizCardContacts}>
                  <a href={`mailto:${leader.email}`} className={styles.bizCardContact}>
                    <span>{leader.email}</span>
                    <Mail className={styles.bizCardContactIcon} aria-hidden />
                  </a>
                  <a
                    href={whatsappUrl(leader.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.bizCardContact}
                  >
                    <span>{leader.phoneDisplay}</span>
                    <MessageCircle className={styles.bizCardContactIcon} aria-hidden />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {socials.length > 0 ? (
          <section className={`${styles.connect} ${styles.reveal} ${styles.revealDelayAlt}`} aria-label="Social links">
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

        <footer className={`${styles.footer} ${styles.reveal} ${styles.revealDelayFooter}`}>
          <Link href="/login" className={styles.teamLogin}>
            Team login
          </Link>
        </footer>
      </div>
    </main>
  );
}
