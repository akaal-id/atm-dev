import { notFound, redirect } from "next/navigation";

import { AiAssistantWidget } from "@/components/app/ai-assistant/ai-assistant-widget";
import { BottomNav } from "@/components/app/bottom-nav";
import { DeviceNotifications } from "@/components/app/device-notifications";
import { LiveRefresh } from "@/components/app/live-refresh";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Topbar } from "@/components/app/topbar";
import { WorkspaceProviders } from "@/components/app/workspace-providers";
import { ContentArea } from "@/components/app/content-area";
import { MainContent } from "@/components/app/main-content";
import { adminNavigation, getBottomNavigation, primaryNavigation } from "@/lib/navigation";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/server/auth";
import {
  ALL_COMPANIES_ID,
  companyHasErpAccess,
  getActiveCompanyContext,
  readActiveCompanyIdCookie,
  readActiveOrganizationIdCookie,
} from "@/lib/server/company-context";
import { assertTenantAccess } from "@/lib/server/tenant-access";
import { listResourceByField } from "@/lib/server/store";
import { cookieToCompanyId, TENANT_ALL } from "@/lib/tenant-path";
import styles from "./app-shell.module.css";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const gate = await assertTenantAccess(user);
  if (gate.status === "not_found") notFound();
  if (gate.status === "forbidden") redirect("/tenant-access-denied");

  const context = await getActiveCompanyContext(user.user_id);
  const cookie = await readActiveCompanyIdCookie();
  const orgCookie = await readActiveOrganizationIdCookie();

  if (user.role_id !== "super_admin") {
    const viewingAll = cookie === ALL_COMPANIES_ID;
    if (viewingAll) {
      const anyPaid = context.companies.some((company) => companyHasErpAccess(company));
      if (!anyPaid) redirect("/billing");
    } else if (!companyHasErpAccess(context.company)) {
      redirect("/billing");
    }
  }

  const tenantOrgId =
    cookie === ALL_COMPANIES_ID
      ? user.role_id === "super_admin"
        ? orgCookie && orgCookie !== TENANT_ALL
          ? orgCookie
          : TENANT_ALL
        : context.organization?.id || TENANT_ALL
      : context.organization?.id || context.company.organization_id;
  const tenantCompanyId = cookieToCompanyId(cookie || context.company.id);

  const notifications = await listResourceByField("Notifications", "user_id", user.user_id, {
    limit: 20,
    orderBy: "created_at",
    select: "notification_id,user_id,title,description,related_link,is_read,created_at,company_id",
  });
  const visiblePrimary = primaryNavigation
    .filter((item) => hasPermission(user.role_id, item.permission))
    .map((item) =>
      item.children
        ? {
            ...item,
            children: item.children.filter((child) => hasPermission(user.role_id, child.permission)),
          }
        : item,
    )
    .filter((item) => !item.children || item.children.length > 0);
  const visibleAdmin = adminNavigation.filter((item) => hasPermission(user.role_id, item.permission));
  const visibleBottom = getBottomNavigation(user.role_id, user.employment_status).filter((item) =>
    hasPermission(user.role_id, item.permission),
  );
  const canCreateTasks =
    hasPermission(user.role_id, "tasks:own") ||
    hasPermission(user.role_id, "tasks:team") ||
    hasPermission(user.role_id, "tasks:manage");

  return (
    <WorkspaceProviders orgId={tenantOrgId} companyId={tenantCompanyId}>
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
            />
            <MainContent>{children}</MainContent>
          </ContentArea>
        </div>
        <BottomNav items={visibleBottom} />
        <AiAssistantWidget />
      </div>
    </WorkspaceProviders>
  );
}
