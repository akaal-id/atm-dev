"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CreateTaskModal } from "@/components/app/create-task-modal";
import { CompanySwitcher } from "@/components/app/company-switcher";
import { OrganizationSwitcher } from "@/components/app/organization-switcher";
import { NotificationLink } from "@/components/app/notification-actions";
import { AppIcon } from "@/components/app/icons";
import { NOTIFICATIONS_POLL_EVENT, type NotificationsPollDetail } from "@/components/app/live-refresh";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { isChatRoomPath } from "@/lib/navigation";
import { getBreadcrumbs } from "@/lib/page-meta";
import type { AppNotification, CurrentUser } from "@/lib/types";
import { useTenant } from "@/components/app/tenant-provider";
import styles from "./topbar.module.css";

interface TopbarProps {
  user: CurrentUser;
  unreadCount: number;
  recentNotifications: AppNotification[];
  canCreateTasks: boolean;
}

export function Topbar({
  user,
  unreadCount,
  recentNotifications,
  canCreateTasks,
}: TopbarProps) {
  const pathname = usePathname();
  const tenant = useTenant();
  const [liveUnreadCount, setLiveUnreadCount] = useState(unreadCount);
  const [liveRecent, setLiveRecent] = useState(recentNotifications);

  useEffect(() => {
    setLiveUnreadCount(unreadCount);
    setLiveRecent(recentNotifications);
  }, [unreadCount, recentNotifications]);

  useEffect(() => {
    const onPoll = (event: Event) => {
      const detail = (event as CustomEvent<NotificationsPollDetail>).detail;
      const unread = detail?.unread ?? [];
      setLiveUnreadCount(unread.length);
      if (unread.length === 0) return;
      setLiveRecent((previous) => {
        const byId = new Map(previous.map((item) => [item.notification_id, item]));
        unread.forEach((item) => byId.set(item.notification_id, item));
        return Array.from(byId.values()).sort(
          (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        );
      });
    };

    window.addEventListener(NOTIFICATIONS_POLL_EVENT, onPoll);
    return () => window.removeEventListener(NOTIFICATIONS_POLL_EVENT, onPoll);
  }, []);

  if (isChatRoomPath(pathname)) return null;

  const breadcrumbs = getBreadcrumbs(pathname, tenant);
  const tenantHref = tenant.href;
  const previewNotifications = [...liveRecent]
    .sort((left, right) => Number(left.is_read) - Number(right.is_read) || new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 3);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className={styles.breadcrumbItem}>
                  {index > 0 ? <span className={styles.breadcrumbSep} aria-hidden="true">/</span> : null}
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className={styles.breadcrumbLink}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={styles.breadcrumbCurrent} aria-current={isLast ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className={styles.actions}>
          <OrganizationSwitcher />
          <CompanySwitcher />

          {canCreateTasks ? (
            <CreateTaskModal
              currentUser={user}
              title="Create ticket"
              triggerVariant="outline"
              triggerClassName={styles.createTask}
            />
          ) : null}

          <Link href={tenantHref("/notifications")} className={styles.notificationButton} aria-label="Open notifications">
            <AppIcon name="Bell" className={styles.icon} />
            {liveUnreadCount > 0 ? <span className={styles.count}>{liveUnreadCount}</span> : null}
          </Link>

          <details className={styles.details}>
            <summary className={styles.summary}>
              <Avatar name={user.full_name} image={user.profile_photo} size="sm" />
              <AppIcon name="ChevronDown" className={styles.chevron} />
            </summary>
            <div className={styles.menu}>
              <div className={styles.userInfo}>
                <p className={styles.userName}>{user.full_name}</p>
                <p className={styles.userRole}>{user.role.role_name}</p>
              </div>
              <div className={styles.notificationList}>
                {previewNotifications.length === 0 ? (
                  <p className={styles.notificationEmpty}>No notifications yet.</p>
                ) : (
                  previewNotifications.map((notification) => (
                    <NotificationLink
                      key={notification.notification_id}
                      notification={notification}
                      href={notification.related_link || "/notifications"}
                      className={notification.is_read ? styles.notificationItem : `${styles.notificationItem} ${styles.notificationItemUnread}`}
                    >
                      <p className={styles.notificationTitle}>{notification.title}</p>
                      <p className={styles.notificationText}>{notification.description}</p>
                    </NotificationLink>
                  ))
                )}
              </div>
              <Link href={tenantHref("/notifications")} className={styles.notificationFooter}>
                View all notifications
              </Link>
              <form action="/api/auth/logout" method="post" className={styles.logoutForm}>
                <Button type="submit" variant="ghost" size="xl" className={styles.logoutButton}>
                  <AppIcon name="LogOut" className={styles.icon} />
                  Sign out
                </Button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
