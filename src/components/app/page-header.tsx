"use client";

import { usePathname } from "next/navigation";

import { isChatRoomPath } from "@/lib/navigation";
import { getPageCopy } from "@/lib/page-meta";
import styles from "./page-header.module.css";

export function PageHeader({ meta }: { meta?: React.ReactNode }) {
  const pathname = usePathname();
  if (isChatRoomPath(pathname)) return null;

  const copy = getPageCopy(pathname);

  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.description}>{copy.description}</p>
      </div>
      {meta ? <div className={styles.meta}>{meta}</div> : null}
    </header>
  );
}
