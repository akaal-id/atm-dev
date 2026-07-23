"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CreateTaskModal, type TaskModalProject, type TaskModalUser } from "@/components/app/create-task-modal";
import { NotificationLink } from "@/components/app/notification-actions";
import { AppIcon } from "@/components/app/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { isChatRoomPath } from "@/lib/navigation";
import { getBreadcrumbs } from "@/lib/page-meta";
import type { AppNotification, CurrentUser } from "@/lib/types";
import styles from "./topbar.module.css";

interface TopbarProps {
  user: CurrentUser;
  unreadCount: number;
  recentNotifications: AppNotification[];
  canCreateTasks: boolean;
  taskModalUsers: TaskModalUser[];
  taskModalProjects: TaskModalProject[];
}

export function Topbar({ user, unreadCount, recentNotifications, canCreateTasks, taskModalUsers, taskModalProjects }: TopbarProps) {
  const pathname = usePathname();
  if (isChatRoomPath(pathname)) return null;

  const breadcrumbs = getBreadcrumbs(pathname);
  const previewNotifications = [...recentNotifications]
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
          {canCreateTasks ? (
            <CreateTaskModal
              currentUser={user}
              users={taskModalUsers}
              projects={taskModalProjects}
              title="Create ticket"
              triggerVariant="outline"
              triggerClassName={styles.createTask}
            />
          ) : null}

          <Link href="/notifications" className={styles.notificationButton} aria-label="Open notifications">
            <AppIcon name="Bell" className={styles.icon} />
            {unreadCount > 0 ? <span className={styles.count}>{unreadCount}</span> : null}
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
              <Link href="/notifications" className={styles.notificationFooter}>
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
