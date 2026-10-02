"use client";

import "@univerjs/preset-sheets-core/lib/index.css";

import styles from "./univer-sheet.module.css";

import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import sheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { useEffect, useRef } from "react";

export type SheetSnapshot = Record<string, unknown>;

/**
 * Univer spreadsheet. Client-only — load with `next/dynamic` and `ssr: false`.
 * `onChange` fires after every data mutation with a getter for the latest snapshot,
 * so the caller decides when to serialise (e.g. debounced autosave).
 */
export function UniverSheet({
  snapshot,
  title,
  editable,
  onChange,
}: {
  snapshot: SheetSnapshot | null;
  title: string;
  editable: boolean;
  onChange?: (getSnapshot: () => SheetSnapshot) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Univer owns the DOM inside the container; create it once per mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(sheetsCoreEnUS) },
      presets: [UniverSheetsCorePreset({ container })],
    });

    const workbook = univerAPI.createWorkbook(snapshot ? (snapshot as never) : { name: title });
    workbook.setEditable(editable);

    const mutation = univerAPI.Enum.CommandType.MUTATION;
    const subscription = workbook.onCommandExecuted((command) => {
      if (command.type === mutation) onChangeRef.current?.(() => workbook.save() as unknown as SheetSnapshot);
    });

    return () => {
      subscription.dispose();
      univer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; later prop changes must not rebuild the workbook
  }, []);

  return <div ref={containerRef} className={styles.root} />;
}
