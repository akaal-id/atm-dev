"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChatUnreadBadge } from "@/components/app/chat-unread";
import { AppIcon } from "@/components/app/icons";
import { useTenant } from "@/components/app/tenant-provider";
import { isChatRoomPath, navItemMatches, type NavigationItem } from "@/lib/navigation";
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
      <div className={styles.bottomnav}>
        {items.map((item) => {
          const isMessagesNav = item.href === "/chat";
          // Task and Productivity also light up on any page inside them (e.g. /projects, /calendar).
          const active = navItemMatches(path, item);
          return (
            <Link
              key={item.href}
              href={tenantHref(item.href)}
              prefetch
              className={cn(styles.item, active && styles.active)}
            >
              <span className={styles.iconWrap}>
                <AppIcon name={item.icon} className={styles.icon} />
                {isMessagesNav ? <ChatUnreadBadge className={styles.badge} /> : null}
              </span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
