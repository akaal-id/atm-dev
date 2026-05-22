"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppIcon } from "@/components/app/icons";
import { Avatar } from "@/components/ui/avatar";
import type { NavigationItem } from "@/lib/navigation";
import type { CurrentUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import styles from "./sidebar-nav.module.css";

interface SidebarNavProps {
  user: CurrentUser;
  items: NavigationItem[];
  adminItems: NavigationItem[];
}

export function SidebarNav({ user, items, adminItems }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandBlock}>
        <Link href="/dashboard" className={styles.brandLink}>
          <div className={styles.logo}>ATM</div>
          <div>
            <p className={styles.brandName}>Akaal Team</p>
            <p className={styles.brandSubtext}>Management</p>
          </div>
        </Link>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navGroup}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(styles.link, active && styles.activePrimary)}
              >
                <AppIcon name={item.icon} className={styles.icon} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {adminItems.length > 0 ? (
          <div className={styles.adminGroup}>
            <p className={styles.groupLabel}>Admin</p>
            <div className={styles.adminLinks}>
              {adminItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(styles.link, active && styles.activeAdmin)}
                  >
                    <AppIcon name={item.icon} className={styles.icon} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </nav>

      <div className={styles.profileBlock}>
        <div className={styles.profileCard}>
          <Avatar name={user.full_name} image={user.profile_photo} size="sm" />
          <div className={styles.profileText}>
            <p className={styles.profileName}>{user.full_name}</p>
            <p className={styles.profileRole}>{user.role.role_name}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
