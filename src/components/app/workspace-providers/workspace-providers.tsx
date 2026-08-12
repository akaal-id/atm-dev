"use client";

import { ToastProvider } from "@/components/ui/toast";
import { TenantProvider } from "@/components/app/tenant-provider";

export function WorkspaceProviders({
  children,
  orgId,
  companyId,
}: {
  children: React.ReactNode;
  orgId?: string;
  companyId?: string;
}) {
  return (
    <ToastProvider>
      <TenantProvider orgId={orgId} companyId={companyId}>
        {children}
      </TenantProvider>
    </ToastProvider>
  );
}
