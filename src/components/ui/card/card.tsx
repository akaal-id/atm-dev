import { cn } from "@/lib/utils";
import styles from "./card.module.css";

export function Card({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "inset" | "flush";
}) {
  return (
    <section
      className={cn(
        styles.card,
        variant === "inset" && styles.section,
        variant === "flush" && styles.flush,
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(styles.header, className)}>{children}</div>;
}

export function CardBody({ children, className, flush = false }: { children: React.ReactNode; className?: string; flush?: boolean }) {
  return <div className={cn(styles.body, flush && styles.bodyFlush, className)}>{children}</div>;
}
