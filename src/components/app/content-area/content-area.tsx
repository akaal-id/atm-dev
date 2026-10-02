"use client";

import { usePathname } from "next/navigation";

import { isChatPath, isChatRoomPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import styles from "@/components/app/app-shell/app-shell.module.css";

export function ContentArea({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChat = isChatPath(pathname);
  const isChatList = isChat && !isChatRoomPath(pathname);

  return <div className={cn(styles.content, isChat && styles.contentChatRoom, isChatList && styles.contentChatList)}>{children}</div>;
}
