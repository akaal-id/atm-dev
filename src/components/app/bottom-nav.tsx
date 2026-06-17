"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppIcon } from "@/components/app/icons";
import type { NavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import styles from "./bottom-nav.module.css";

export function BottomNav({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  // Full-height chat manages its own footer; hide the tab bar so the input stays reachable.
  if (pathname.startsWith("/chat")) return null;

  return (
    <nav className={styles.nav}>
      <div className={styles.grid}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(styles.item, active && styles.active)}
            >
              <AppIcon name={item.icon} className={styles.icon} />
              <span className={styles.label}>{item.label.replace("My ", "")}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
