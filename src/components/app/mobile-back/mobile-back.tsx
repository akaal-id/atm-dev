"use client";

import styles from "./mobile-back.module.css";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useTenant } from "@/components/app/tenant-provider";
import { isRootPath, parentHref } from "@/lib/navigation";

/**
 * Phones have no sidebar or breadcrumbs, so pages below the bottom-bar destinations get a small
 * "Back" link above their content. It follows in-app history when there is some; opened cold
 * (e.g. from a notification) it goes up to the page's parent menu instead.
 * Lives in MainContent, which stays mounted across navigations, so it can remember the trail.
 */
export function MobileBack({ path }: { path: string }) {
  const router = useRouter();
  const { href: tenantHref } = useTenant();
  const visited = useRef<string[]>([]);

  useEffect(() => {
    const stack = visited.current;
    if (stack.length >= 2 && stack[stack.length - 2] === path) stack.pop();
    else if (stack[stack.length - 1] !== path) stack.push(path);
  }, [path]);

  if (isRootPath(path)) return null;

  function goBack() {
    if (visited.current.length >= 2) router.back();
    else router.push(tenantHref(parentHref(path)));
  }

  return (
    <button type="button" className={styles.back} onClick={goBack}>
      <ChevronLeft className={styles.icon} aria-hidden />
      Back
    </button>
  );
}
