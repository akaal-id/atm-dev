import styles from "./not-found-view.module.css";

type NotFoundViewProps = {
  description?: string;
};

/** Shared 404 / unavailable page used as the app default. */
export function NotFoundView({
  description = "Halaman yang Anda cari tidak ditemukan atau sudah tidak tersedia.",
}: NotFoundViewProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.badge}>404</span>
        <h1 className={styles.title}>Halaman tidak tersedia</h1>
        <p className={styles.itemDescription}>{description}</p>
      </section>
    </main>
  );
}
