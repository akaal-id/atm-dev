import styles from "./page-header.module.css";

/** The page title card. Pages that need their own header actions render it themselves. */
export function PageHero({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
      {actions ? <div className={styles.caption}>{actions}</div> : null}
    </header>
  );
}
