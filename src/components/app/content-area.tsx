"use client";

import { usePathname } from "next/navigation";

import { isChatRoomPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import styles from "./app-shell.module.css";

export function ContentArea({ children }: { children: React.ReactNode }) {
  const isChatRoom = isChatRoomPath(usePathname());

  return <div className={cn(styles.content, isChatRoom && styles.contentChatRoom)}>{children}</div>;
}
