"use client";

import { usePathname } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { isChatRoomPath } from "@/lib/navigation";
import { appPathname } from "@/lib/tenant-path";
import { cn } from "@/lib/utils";
import styles from "@/components/app/app-shell/app-shell.module.css";

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const path = appPathname(pathname);
  const isChatRoom = isChatRoomPath(pathname);
  const isAiChat = path === "/ai-chat";
  const isWorkflowDetail = /^\/workflows\/(?!new(?:\/|$))[^/]+/.test(path);
  const isNewWorkflow = path === "/workflows/new" || path.startsWith("/workflows/new/");
  const showPageHeader = !isChatRoom && !isAiChat && path !== "/dashboard" && !isWorkflowDetail && !isNewWorkflow;

  return (
    <main className={cn(styles.main, isChatRoom && styles.mainChatRoom)}>
      {showPageHeader ? <PageHeader /> : null}
      {children}
    </main>
  );
}
