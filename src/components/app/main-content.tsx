"use client";

import { usePathname } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { isChatRoomPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import styles from "./app-shell.module.css";

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatRoom = isChatRoomPath(pathname);
  const showPageHeader = !isChatRoom && pathname !== "/dashboard";

  return (
    <main className={cn(styles.main, isChatRoom && styles.mainChatRoom)}>
      {showPageHeader ? <PageHeader /> : null}
      {children}
    </main>
  );
}
