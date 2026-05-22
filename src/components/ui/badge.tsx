import { cn } from "@/lib/utils";
import styles from "./badge.module.css";

interface BadgeProps {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "yellow" | "red" | "purple";
  className?: string;
}

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return <span className={cn(styles.badge, styles[tone], className)}>{children}</span>;
}
