"use client";

import { useEffect, useState } from "react";

import type { WorkType } from "@/lib/scoring";

export type WorkTypeCatalog = { workTypes: WorkType[]; defaultEffort: number; picShare: number };

let cache: Promise<WorkTypeCatalog> | null = null;

/** Active work types for task forms; fetched once per page load. */
export function useWorkTypes(enabled = true) {
  const [state, setState] = useState<WorkTypeCatalog | null>(null);

  useEffect(() => {
    if (!enabled) return;
    cache ??= fetch("/api/gamification/config", { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : { data: null }))
      .then((body: { data?: Partial<WorkTypeCatalog> | null }) => ({
        workTypes: body.data?.workTypes ?? [],
        defaultEffort: body.data?.defaultEffort ?? 2,
        picShare: body.data?.picShare ?? 0.6,
      }))
      .catch(() => {
        cache = null;
        return { workTypes: [], defaultEffort: 2, picShare: 0.6 };
      });
    let active = true;
    void cache.then((value) => active && setState(value));
    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}
