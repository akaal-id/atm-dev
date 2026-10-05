"use client";

import { ToastProvider } from "@/components/ui/toast";
import { ChatUnreadProvider } from "@/components/app/chat-unread";
import { TenantProvider } from "@/components/app/tenant-provider";

export function WorkspaceProviders({
  children,
  orgId,
  companyId,
  userId,
}: {
  children: React.ReactNode;
  orgId?: string;
  companyId?: string;
  userId: string;
}) {
  return (
    <ToastProvider>
      <TenantProvider orgId={orgId} companyId={companyId}>
        <ChatUnreadProvider userId={userId}>{children}</ChatUnreadProvider>
      </TenantProvider>
    </ToastProvider>
  );
}
