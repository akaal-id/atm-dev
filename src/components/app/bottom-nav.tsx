"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppIcon } from "@/components/app/icons";
import { isChatRoomPath, type NavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import styles from "./bottom-nav.module.css";

export function BottomNav({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  // Hide nav only inside an active chat room so the composer can use the full viewport.
  if (isChatRoomPath(pathname)) return null;

  return (
    <nav className={styles.nav}>
      <div className={styles.grid}>
        {items.map((item) => {
          const isTaskNav = item.href.startsWith("/tasks/");
          const isMessagesNav = item.href === "/chat";
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (isTaskNav && /^\/tasks\/(?!my|team)[^/]+$/.test(pathname)) ||
            (isMessagesNav && pathname === "/chat");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(styles.item, active && styles.active)}
            >
              <AppIcon name={item.icon} className={styles.icon} />
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
