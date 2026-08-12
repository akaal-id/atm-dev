"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppIcon } from "@/components/app/icons";
import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import type { NavigationItem } from "@/lib/navigation";
import { appPathname } from "@/lib/tenant-path";
import { cn } from "@/lib/utils";
import styles from "./sidebar-nav.module.css";

const STORAGE_KEY = "atm-sidebar-collapsed";

interface SidebarNavProps {
  items: NavigationItem[];
  adminItems: NavigationItem[];
}

function isItemActive(pathname: string, item: NavigationItem) {
  if (item.children?.length) {
    return item.children.some((child) => isChildActive(pathname, child.href));
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function isChildActive(pathname: string, href: string) {
  if (href === "/email-blast") return pathname === "/email-blast";
  if (href === "/tasks/my") return pathname === "/tasks/my" || pathname.startsWith("/tasks/my/");
  if (href === "/tasks/team") return pathname === "/tasks/team" || pathname.startsWith("/tasks/team/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items, adminItems }: SidebarNavProps) {
  const pathname = usePathname();
  const path = appPathname(pathname);
  const { href: tenantHref } = useTenant();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const navItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        linkHref: tenantHref(item.href),
        children: item.children?.map((child) => ({ ...child, linkHref: tenantHref(child.href) })),
      })),
    [items, tenantHref],
  );

  const adminNavItems = useMemo(
    () => adminItems.map((item) => ({ ...item, linkHref: tenantHref(item.href) })),
    [adminItems, tenantHref],
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setCollapsed(true);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed, hydrated]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of items) {
      if (item.children?.length && isItemActive(path, item)) {
        next[item.href] = true;
      }
    }
    setOpenGroups((current) => ({ ...current, ...next }));
  }, [path, items]);

  function toggleCollapsed() {
    setCollapsed((current) => !current);
  }

  function toggleGroup(href: string) {
    setOpenGroups((current) => ({ ...current, [href]: !current[href] }));
  }

  return (
    <aside className={cn(styles.sidebar, collapsed && styles.collapsed)}>
      <div className={styles.brandBlock}>
        <Link href={tenantHref("/dashboard")} className={styles.brandLink} title="Akaal Team Management">
          <span className={styles.logoWrap}>
            <img
              src="/icon/mono-akaal-white.png"
              alt="Akaal Logo"
              className={styles.logo}
              width={32}
              height={32}
            />
          </span>

          <div className={styles.brandText}>
            <p className={styles.brandName}>Akaal Team</p>
            <p className={styles.brandSubtext}>Management</p>
          </div>
        </Link>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navGroup}>
          {navItems.map((item) => {
            const active = isItemActive(path, item);
            const hasChildren = Boolean(item.children?.length);
            const expanded = hasChildren && (openGroups[item.href] || active) && !collapsed;

            if (hasChildren && item.children) {
              return (
                <div key={item.href} className={styles.navTree}>
                  <button
                    type="button"
                    title={item.label}
                    className={cn(styles.link, styles.groupTrigger, active && styles.activePrimary)}
                    aria-expanded={expanded}
                    onClick={() => {
                      if (collapsed) {
                        setCollapsed(false);
                        setOpenGroups((current) => ({ ...current, [item.href]: true }));
                        return;
                      }
                      toggleGroup(item.href);
                    }}
                  >
                    <AppIcon name={item.icon} className={styles.icon} />
                    <span className={styles.linkLabel}>{item.label}</span>
                    <ChevronDown className={cn(styles.chevron, expanded && styles.chevronOpen)} aria-hidden />
                  </button>
                  {expanded ? (
                    <div className={styles.subLinks}>
                      {item.children.map((child) => {
                        const childActive = isChildActive(path, child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.linkHref}
                            title={child.label}
                            className={cn(styles.subLink, childActive && styles.activePrimary)}
                          >
                            <span className={styles.subLinkLabel}>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.linkHref}
                title={item.label}
                className={cn(styles.link, active && styles.activePrimary)}
              >
                <AppIcon name={item.icon} className={styles.icon} />
                <span className={styles.linkLabel}>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {adminNavItems.length > 0 ? (
          <div className={styles.adminGroup}>
            <p className={styles.groupLabel}>Admin</p>
            <div className={styles.adminLinks}>
              {adminNavItems.map((item) => {
                const active = path === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.linkHref}
                    title={item.label}
                    className={cn(styles.link, active && styles.activeAdmin)}
                  >
                    <AppIcon name={item.icon} className={styles.icon} />
                    <span className={styles.linkLabel}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </nav>

      <div className={styles.footer}>
        <Button
          type="button"
          variant="ghost"
          className={cn(styles.toggleButton, !collapsed && styles.toggleButtonExpanded)}
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className={styles.toggleIcon} aria-hidden />
          ) : (
            <>
              <span className={styles.toggleLabel}>Collapse</span>
              <ChevronLeft className={styles.toggleIcon} aria-hidden />
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
