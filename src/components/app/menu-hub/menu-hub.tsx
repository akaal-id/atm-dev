"use client";

import styles from "./menu-hub.module.css";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { AppIcon } from "@/components/app/icons";
import { useTenant } from "@/components/app/tenant-provider";
import type { IconName } from "@/lib/navigation";

export type MenuHubSection = {
  title: string;
  items: Array<{ href: string; label: string; icon: IconName; description?: string }>;
};

/** A page of menu tiles — what phones open for a menu that has sub-menus (Task, Productivity). */
export function MenuHub({ sections }: { sections: MenuHubSection[] }) {
  const { href: tenantHref } = useTenant();

  return (
    <div className={styles.root}>
      {sections.map((section) => (
        <section key={section.title} className={styles.section} aria-label={section.title}>
          {sections.length > 1 ? <h2 className={styles.heading}>{section.title}</h2> : null}
          <ul className={styles.grid}>
            {section.items.map((item) => (
              <li key={item.href}>
                <Link href={tenantHref(item.href)} prefetch className={styles.tile}>
                  <span className={styles.icon}>
                    <AppIcon name={item.icon} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.label}>{item.label}</span>
                    {item.description ? <span className={styles.description}>{item.description}</span> : null}
                  </span>
                  <ChevronRight className={styles.chevron} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
