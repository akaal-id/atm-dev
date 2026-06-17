import { BottomNav } from "@/components/app/bottom-nav";
import { DeviceNotifications } from "@/components/app/device-notifications";
import { LiveRefresh } from "@/components/app/live-refresh";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Topbar } from "@/components/app/topbar";
import { adminNavigation, getBottomNavigation, primaryNavigation } from "@/lib/navigation";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/server/auth";
import { listResource, listResourceByField } from "@/lib/server/store";
import { ContentArea } from "@/components/app/content-area";
import { MainContent } from "@/components/app/main-content";
import styles from "./app-shell.module.css";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await listResourceByField("Notifications", "user_id", user.user_id, {
    limit: 20,
    orderBy: "created_at",
  });
  const [users, projects] = await Promise.all([listResource("Users"), listResource("Projects")]);
  const visiblePrimary = primaryNavigation.filter((item) => hasPermission(user.role_id, item.permission));
  const visibleAdmin = adminNavigation.filter((item) => hasPermission(user.role_id, item.permission));
  const visibleBottom = getBottomNavigation(user.role_id, user.employment_status).filter((item) =>
    hasPermission(user.role_id, item.permission),
  );
  const canCreateTasks =
    hasPermission(user.role_id, "tasks:own") ||
    hasPermission(user.role_id, "tasks:team") ||
    hasPermission(user.role_id, "tasks:manage");
  const taskModalUsers = users.map((entry) => ({ user_id: entry.user_id, full_name: entry.full_name, is_active: entry.is_active }));
  const taskModalProjects = projects.map((project) => ({
    project_id: project.project_id,
    project_name: project.project_name,
    ticket_id_prefix: project.ticket_id_prefix || "",
  }));

  return (
    <div className={styles.shell}>
      <DeviceNotifications />
      <LiveRefresh />
      <div className={styles.layout}>
        <SidebarNav items={visiblePrimary} adminItems={visibleAdmin} />
        <ContentArea>
          <Topbar
            user={user}
            unreadCount={notifications.filter((notification) => !notification.is_read).length}
            recentNotifications={notifications}
            canCreateTasks={canCreateTasks}
            taskModalUsers={taskModalUsers}
            taskModalProjects={taskModalProjects}
          />
          <MainContent>{children}</MainContent>
        </ContentArea>
      </div>
      <BottomNav items={visibleBottom} />
    </div>
  );
}
