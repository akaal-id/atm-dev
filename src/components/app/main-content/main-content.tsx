"use client";

import { usePathname } from "next/navigation";

import { MobileBack } from "@/components/app/mobile-back";
import { PageHeader } from "@/components/app/page-header";
import { isChatPath } from "@/lib/navigation";
import { appPathname } from "@/lib/tenant-path";
import { cn } from "@/lib/utils";
import styles from "@/components/app/app-shell/app-shell.module.css";

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const path = appPathname(pathname);
  const isChatRoom = isChatPath(pathname);
  const isAiChat = path === "/ai-chat";
  const isWorkflowDetail = /^\/workflows\/(?!new(?:\/|$))[^/]+/.test(path);
  const isNewWorkflow = path === "/workflows/new" || path.startsWith("/workflows/new/");
  // Attendance pages render their own header so it can carry their actions.
  const ownsHeader = path === "/attendance" || path.startsWith("/attendance/");
  // Detail pages that already carry their own "back to list" link.
  const hasOwnBackLink = isWorkflowDetail || /^\/(projects|office|email-blast\/history|email-blast\/contacts)\/[^/]+$/.test(path);
  const showPageHeader = !isChatRoom && !isAiChat && path !== "/dashboard" && !isWorkflowDetail && !isNewWorkflow && !ownsHeader;

  return (
    <main className={cn(styles.main, isChatRoom && styles.mainChatRoom)}>
      {!isChatRoom && !isAiChat && !hasOwnBackLink ? <MobileBack path={path} /> : null}
      {showPageHeader ? <PageHeader /> : null}
      {children}
    </main>
  );
}
