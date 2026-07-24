"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppIcon } from "@/components/app/icons";
import { useTenant } from "@/components/app/tenant-provider";
import { isChatRoomPath, type NavigationItem } from "@/lib/navigation";
import { appPathname } from "@/lib/tenant-path";
import { cn } from "@/lib/utils";
import styles from "./bottom-nav.module.css";

export function BottomNav({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();
  const path = appPathname(pathname);
  const { href: tenantHref } = useTenant();

  if (isChatRoomPath(pathname)) return null;

  return (
    <nav className={styles.nav}>
      <div className={styles.grid}>
        {items.map((item) => {
          const isTaskNav = item.href.startsWith("/tasks/");
          const isMessagesNav = item.href === "/chat";
          const active =
            path === item.href ||
            path.startsWith(`${item.href}/`) ||
            (isTaskNav && /^\/tasks\/(?!my|team)[^/]+$/.test(path)) ||
            (isMessagesNav && path === "/chat");
          return (
            <Link
              key={item.href}
              href={tenantHref(item.href)}
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
