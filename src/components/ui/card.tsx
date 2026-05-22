import { cn } from "@/lib/utils";
import styles from "./card.module.css";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn(styles.card, className)}>{children}</section>;
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(styles.header, className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(styles.body, className)}>{children}</div>;
}
