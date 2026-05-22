import type { LucideIcon } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
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
    <Card className="overflow-hidden">
      <CardBody className={styles.content}>
        <div>
          <p className={styles.label}>{label}</p>
          <p className={styles.value}>{value}</p>
          <p className={styles.detail}>{detail}</p>
        </div>
        <div className={cn(styles.iconWrap, styles[tone])}>
          <Icon className={styles.icon} />
        </div>
      </CardBody>
    </Card>
  );
}
