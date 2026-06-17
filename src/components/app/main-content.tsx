"use client";

import { usePathname } from "next/navigation";

import { isChatRoomPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import styles from "./app-shell.module.css";

export function MainContent({ children }: { children: React.ReactNode }) {
  const isChatRoom = isChatRoomPath(usePathname());

  return <main className={cn(styles.main, isChatRoom && styles.mainChatRoom)}>{children}</main>;
}
