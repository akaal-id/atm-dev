import { BottomNav } from "@/components/app/bottom-nav";
import { DeviceNotifications } from "@/components/app/device-notifications";
import { LiveRefresh } from "@/components/app/live-refresh";
import { PwaRegister } from "@/components/app/pwa-register";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Topbar } from "@/components/app/topbar";
import { adminNavigation, bottomNavigation, primaryNavigation } from "@/lib/navigation";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/server/auth";
import { listResourceByField } from "@/lib/server/store";
import styles from "./app-shell.module.css";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await listResourceByField("Notifications", "user_id", user.user_id, {
    limit: 20,
    orderBy: "created_at",
  });
  const visiblePrimary = primaryNavigation.filter((item) => hasPermission(user.role_id, item.permission));
  const visibleAdmin = adminNavigation.filter((item) => hasPermission(user.role_id, item.permission));
  const visibleBottom = bottomNavigation.filter((item) => hasPermission(user.role_id, item.permission));

  return (
    <div className={styles.shell}>
      <PwaRegister />
      <DeviceNotifications />
      <LiveRefresh />
      <div className={styles.layout}>
        <SidebarNav user={user} items={visiblePrimary} adminItems={visibleAdmin} />
        <div className={styles.content}>
          <Topbar user={user} unreadCount={notifications.filter((notification) => !notification.is_read).length} recentNotifications={notifications} />
          <main className={styles.main}>{children}</main>
        </div>
      </div>
      <BottomNav items={visibleBottom} />
    </div>
  );
}
