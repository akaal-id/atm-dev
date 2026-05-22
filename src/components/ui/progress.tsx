import { percent } from "@/lib/utils";
import styles from "./progress.module.css";

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className={styles.root}>
      <div className={styles.meta}>
        <span>{label ?? "Progress"}</span>
        <span>{percent(value)}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.bar} style={{ width: percent(value) }} />
      </div>
    </div>
  );
}
