"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { AppNotification } from "@/lib/types";
import { scheduleRouterRefresh } from "@/lib/safe-router-refresh";

async function markNotificationsRead(notificationId?: string) {
  const response = await fetch("/api/notifications/read", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(notificationId ? { notification_id: notificationId } : {}),
  });

  if (!response.ok) {
    throw new Error("Failed to update notifications");
  }
}

interface NotificationLinkProps {
  notification: AppNotification;
  href: string;
  className?: string;
  children: React.ReactNode;
}

export function NotificationLink({ notification, href, className, children }: NotificationLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Link
      href={href}
      className={className}
      aria-busy={isPending}
      onClick={(event) => {
        if (notification.is_read) return;

        event.preventDefault();
        startTransition(async () => {
          await markNotificationsRead(notification.notification_id);
          router.push(href);
          scheduleRouterRefresh(router);
        });
      }}
    >
      {children}
    </Link>
  );
}

interface MarkAllNotificationsReadButtonProps {
  disabled?: boolean;
  className?: string;
}

export function MarkAllNotificationsReadButton({ disabled, className }: MarkAllNotificationsReadButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          await markNotificationsRead();
          scheduleRouterRefresh(router);
        });
      }}
    >
      {isPending ? "Marking..." : "Mark all as read"}
    </button>
  );
}
