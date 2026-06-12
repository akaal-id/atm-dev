"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import styles from "./tabs.module.css";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  items?: TabItem[];
  labels?: string[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  "aria-label"?: string;
  className?: string;
}

export function Tabs({ items, labels, value, defaultValue, onValueChange, "aria-label": ariaLabel, className }: TabsProps) {
  const resolvedItems: TabItem[] = items ?? labels?.map((label) => ({ id: label, label })) ?? [];
  const [internalValue, setInternalValue] = useState(defaultValue ?? resolvedItems[0]?.id ?? "");
  const activeValue = value ?? internalValue;

  function select(id: string) {
    if (value === undefined) {
      setInternalValue(id);
    }
    onValueChange?.(id);
  }

  if (resolvedItems.length === 0) return null;

  return (
    <div className={cn(styles.list, className)} role="tablist" aria-label={ariaLabel}>
      {resolvedItems.map((item) => {
        const isActive = activeValue === item.id;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => select(item.id)}
            className={cn(styles.trigger, isActive && styles.triggerActive)}
          >
            {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
