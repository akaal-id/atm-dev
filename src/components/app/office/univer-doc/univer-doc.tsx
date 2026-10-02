"use client";

import "@univerjs/preset-docs-core/lib/index.css";
import "@univerjs/preset-docs-drawing/lib/index.css";
import "@univerjs/preset-docs-hyper-link/lib/index.css";

import styles from "./univer-doc.module.css";

import { UniverDocsCorePreset } from "@univerjs/preset-docs-core";
import docsCoreEnUS from "@univerjs/preset-docs-core/locales/en-US";
import { UniverDocsDrawingPreset } from "@univerjs/preset-docs-drawing";
import docsDrawingEnUS from "@univerjs/preset-docs-drawing/locales/en-US";
import { UniverDocsHyperLinkPreset } from "@univerjs/preset-docs-hyper-link";
import docsHyperLinkEnUS from "@univerjs/preset-docs-hyper-link/locales/en-US";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { useEffect, useRef } from "react";

import type { DocumentData } from "@/lib/office-doc";

/**
 * Univer Docs editor (fonts, sizes, colours, lists, headings, tables, images,
 * links, header/footer). Client-only — load with `next/dynamic` and `ssr: false`.
 * Remount (change `key`) to load different data; `onChange` fires after each
 * data mutation with a getter for the latest document.
 */
export function UniverDoc({
  data,
  editable,
  onChange,
}: {
  data: DocumentData;
  editable: boolean;
  onChange?: (getData: () => DocumentData) => void;
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
      locales: { [LocaleType.EN_US]: mergeLocales(docsCoreEnUS, docsDrawingEnUS, docsHyperLinkEnUS) },
      presets: [UniverDocsCorePreset({ container }), UniverDocsDrawingPreset(), UniverDocsHyperLinkPreset()],
    });

    const document = univerAPI.createDocument(data as never);
    const unitId = document.getId();
    if (!editable) void document.getPermission().setReadOnly();

    const mutation = univerAPI.Enum.CommandType.MUTATION;
    const subscription = univerAPI.addEvent(univerAPI.Event.CommandExecuted, (event) => {
      const params = event.params as { unitId?: string } | undefined;
      if (event.type !== mutation || (params?.unitId && params.unitId !== unitId)) return;
      onChangeRef.current?.(() => document.save() as unknown as DocumentData);
    });

    return () => {
      subscription.dispose();
      univer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; remount via `key` to load other data
  }, []);

  return <div ref={containerRef} className={styles.root} />;
}
