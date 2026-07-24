"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";

import { useTenant } from "@/components/app/tenant-provider";
import { buttonVariants } from "@/components/ui/button";
import { isChatRoomPath } from "@/lib/navigation";
import { getPageCopy } from "@/lib/page-meta";
import { appPathname } from "@/lib/tenant-path";
import { cn } from "@/lib/utils";
import styles from "./page-header.module.css";

export function PageHeader({ meta }: { meta?: React.ReactNode }) {
  const pathname = usePathname();
  const path = appPathname(pathname);
  const tenant = useTenant();
  if (isChatRoomPath(pathname)) return null;
  if (path === "/workflows/new" || path.startsWith("/workflows/new/")) return null;

  const copy = getPageCopy(pathname);
  const headerMeta =
    meta ??
    (path === "/workflows" ? (
      <Link href={tenant.href("/workflows/new")} className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-10 font-normal")}>
        <Plus className="h-4 w-4" aria-hidden />
        New workflow
      </Link>
    ) : null);

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.description}>{copy.description}</p>
      </div>
      {headerMeta ? <div className={styles.meta}>{headerMeta}</div> : null}
    </header>
  );
}
