"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NotificationLink } from "@/components/app/notification-actions";
import { AppIcon } from "@/components/app/icons";
import { Avatar } from "@/components/ui/avatar";
import { pageCopy } from "@/lib/navigation";
import type { AppNotification, CurrentUser } from "@/lib/types";
import styles from "./topbar.module.css";

interface TopbarProps {
  user: CurrentUser;
  unreadCount: number;
  recentNotifications: AppNotification[];
}

function getCopy(pathname: string) {
  const exact = pageCopy[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/tasks/")) return { title: "Task detail", eyebrow: "Execution", description: "Checklist, comments, status history, and activity log." };
  if (pathname.startsWith("/employees/")) return { title: "Employee profile", eyebrow: "People", description: "Profile, attendance, task history, birthday, and performance score." };
  return pageCopy["/dashboard"];
}

export function Topbar({ user, unreadCount, recentNotifications }: TopbarProps) {
  const pathname = usePathname();
  const copy = getCopy(pathname);
  const previewNotifications = [...recentNotifications]
    .sort((left, right) => Number(left.is_read) - Number(right.is_read) || new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 3);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.description}>{copy.description}</p>
        </div>

        <div className={styles.actions}>
          <div className={styles.search}>
            <AppIcon name="Search" className={styles.icon} />
            <input className={styles.searchInput} placeholder="Search tasks, people, events" />
          </div>

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
                <p className={styles.userEmail}>{user.email}</p>
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
                <button className={styles.logoutButton}>
                  <AppIcon name="LogOut" className={styles.icon} />
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
