import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "./metric-card.module.css";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "dark" | "blue" | "green" | "yellow";
}

export function MetricCard({ label, value, detail, icon: Icon, tone = "dark" }: MetricCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.content}>
        <div className={styles.copy}>
          <p className={styles.label}>{label}</p>
          <p className={styles.value}>{value}</p>
          <p className={styles.detail}>{detail}</p>
        </div>
        <div className={cn(styles.iconWrap, styles[tone])}>
          <Icon className={styles.icon} />
        </div>
      </div>
    </article>
  );
}
