"use client";

import styles from "./ai-chat-fab.module.css";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isChatPath } from "@/lib/navigation";
import { useTenant } from "@/components/app/tenant-provider";
import { appPathname } from "@/lib/tenant-path";

/**
 * Opens the AI assistant. Must be next/link (not a raw <a>) so the
 * intercepting route can soft-nav into the overlay; a hard refresh or
 * direct visit still lands on the full-page fallback.
 */
export function AiChatFab() {
  const pathname = usePathname();
  const { href: tenantHref } = useTenant();
  const appPath = appPathname(pathname);

  // Hidden in chat: it would cover the message composer and send button.
  if (appPath === "/ai-chat" || isChatPath(pathname)) return null;

  return (
    <div className={styles.fabWrap} data-ai-fab>
      <Link
        href={tenantHref(`/ai-chat?from=${encodeURIComponent(appPath)}`)}
        className={styles.fab}
        aria-label="Buka asisten ATM"
        scroll={false}
      >
        <MessageCircle className={styles.fabIcon} aria-hidden />
      </Link>
    </div>
  );
}
