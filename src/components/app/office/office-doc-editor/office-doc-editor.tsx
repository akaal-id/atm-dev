"use client";

import styles from "./office-doc-editor.module.css";

import { Copy, FileCog, FileText, Loader2, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { DocPageSetupModal } from "@/components/app/office/doc-page-setup-modal";
import { Button } from "@/components/ui/button";
import { applyPageSetup, newTab, readPageSetup, toDocSnapshot, type DocSnapshot, type DocTab, type DocumentData, type PageSetup } from "@/lib/office-doc";
import { cn } from "@/lib/utils";

const UniverDoc = dynamic(() => import("@/components/app/office/univer-doc").then((module) => module.UniverDoc), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <Loader2 className={styles.spinner} aria-hidden /> Loading document…
    </div>
  ),
});

/**
 * Tabbed document: each tab is its own Univer document (switching remounts the editor).
 * `bindSnapshot` hands the parent a getter for the full, up-to-date snapshot;
 * `onChange` fires after any edit, tab change, or page-setup change.
 * Client-only (legacy HTML import uses DOMParser) — load with `next/dynamic`, `ssr: false`.
 */
export function OfficeDocEditor({
  snapshot,
  legacyHtml,
  title,
  editable,
  bindSnapshot,
  onChange,
}: {
  /** Stored `office_files.snapshot` (v2 tabs) or null. */
  snapshot: unknown;
  /** Stored HTML content, imported when there is no snapshot yet (e.g. notes saved from chat). */
  legacyHtml: string;
  title: string;
  editable: boolean;
  bindSnapshot: (getSnapshot: () => DocSnapshot) => void;
  onChange: () => void;
}) {
  const [initial] = useState(() => toDocSnapshot(snapshot, legacyHtml, title));
  const [tabs, setTabsState] = useState<DocTab[]>(initial.tabs);
  const [activeId, setActiveId] = useState(initial.tabs[0].id);
  const [mountVersion, setMountVersion] = useState(0);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pageSetupFor, setPageSetupFor] = useState<PageSetup | null>(null);

  // Refs mirror state so getters called from outside always see the latest values.
  const tabsRef = useRef(tabs);
  const activeRef = useRef(activeId);
  const activeGetter = useRef<(() => DocumentData) | null>(null);

  const setTabs = (next: DocTab[]) => {
    tabsRef.current = next;
    setTabsState(next);
  };

  /** Tabs with the active tab's live editor content folded in. */
  const capture = () => {
    const getter = activeGetter.current;
    if (!getter) return tabsRef.current;
    const data = getter();
    return tabsRef.current.map((tab) => (tab.id === activeRef.current ? { ...tab, data } : tab));
  };

  useEffect(() => {
    bindSnapshot(() => ({ version: 2, tabs: capture() }));
  }, [bindSnapshot]);

  function activate(id: string) {
    activeRef.current = id;
    activeGetter.current = null;
    setActiveId(id);
    setConfirmDeleteId(null);
  }

  function switchTab(id: string) {
    if (id === activeRef.current) return;
    setTabs(capture());
    activate(id);
  }

  function addTab(source?: DocTab) {
    const current = capture();
    const active = current.find((tab) => tab.id === activeRef.current) ?? current[0];
    const tab = source
      ? { ...newTab(`${source.title} (copy)`), data: { ...structuredClone(source.data), id: `doc_${crypto.randomUUID().slice(0, 8)}` } }
      : newTab(`Tab ${current.length + 1}`, readPageSetup(active.data, active.setup));
    setTabs([...current, tab]);
    activate(tab.id);
    setRenamingId(tab.id);
    onChange();
  }

  function renameTab(id: string, title: string) {
    setRenamingId(null);
    const next = title.trim().slice(0, 60);
    if (!next) return;
    setTabs(capture().map((tab) => (tab.id === id ? { ...tab, title: next } : tab)));
    onChange();
  }

  function deleteTab(id: string) {
    const current = capture();
    if (current.length <= 1) return;
    const index = current.findIndex((tab) => tab.id === id);
    const remaining = current.filter((tab) => tab.id !== id);
    setTabs(remaining);
    if (id === activeRef.current) activate(remaining[Math.max(0, index - 1)].id);
    setConfirmDeleteId(null);
    onChange();
  }

  function applySetup(setup: PageSetup, allTabs: boolean) {
    setPageSetupFor(null);
    setTabs(capture().map((tab) => (allTabs || tab.id === activeRef.current ? { ...tab, data: applyPageSetup(tab.data, setup), setup } : tab)));
    activeGetter.current = null;
    setMountVersion((version) => version + 1); // reload the editor with the new page layout
    onChange();
  }

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const activeMode = readPageSetup(active.data, active.setup).mode;

  /** Quick Pages ⇄ Pageless switch for the active tab, keeping its paper settings. */
  function setMode(mode: PageSetup["mode"]) {
    if (mode === activeMode) return;
    const tab = capture().find((item) => item.id === activeRef.current) ?? tabsRef.current[0];
    applySetup({ ...readPageSetup(tab.data, tab.setup), mode }, false);
  }

  return (
    <div className={styles.root}>
      <div className={styles.tabBar}>
        <div className={styles.tabs} role="tablist" aria-label="Document tabs">
          {tabs.map((tab) => {
            const isActive = tab.id === active.id;
            return (
              <div key={tab.id} className={cn(styles.tab, isActive && styles.tabActive)}>
                {renamingId === tab.id && editable ? (
                  <input
                    className={styles.tabInput}
                    defaultValue={tab.title}
                    autoFocus
                    maxLength={60}
                    aria-label="Tab name"
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={(event) => renameTab(tab.id, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={styles.tabButton}
                    onClick={() => switchTab(tab.id)}
                    onDoubleClick={() => editable && setRenamingId(tab.id)}
                    title={editable ? "Double-click to rename" : undefined}
                  >
                    {tab.title}
                  </button>
                )}
                {isActive && editable && renamingId !== tab.id ? (
                  <span className={styles.tabActions}>
                    <button type="button" className={styles.tabIcon} onClick={() => setRenamingId(tab.id)} aria-label={`Rename ${tab.title}`}>
                      <Pencil />
                    </button>
                    <button type="button" className={styles.tabIcon} onClick={() => addTab(capture().find((item) => item.id === tab.id))} aria-label={`Duplicate ${tab.title}`}>
                      <Copy />
                    </button>
                    {tabs.length > 1 ? (
                      confirmDeleteId === tab.id ? (
                        <button type="button" className={styles.confirmDelete} onClick={() => deleteTab(tab.id)}>
                          Delete?
                        </button>
                      ) : (
                        <button type="button" className={styles.tabIcon} onClick={() => setConfirmDeleteId(tab.id)} aria-label={`Delete ${tab.title}`}>
                          <Trash2 />
                        </button>
                      )
                    ) : null}
                  </span>
                ) : null}
              </div>
            );
          })}
          {editable ? (
            <button type="button" className={styles.addTab} onClick={() => addTab()} aria-label="Add tab">
              <Plus />
            </button>
          ) : null}
        </div>
        {editable ? (
          <div className={styles.modeSwitch} role="radiogroup" aria-label="Page format">
            {(
              [
                ["pages", "Pages", FileText],
                ["pageless", "Pageless", ScrollText],
              ] as const
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={activeMode === mode}
                className={cn(styles.mode, activeMode === mode && styles.modeActive)}
                onClick={() => setMode(mode)}
                title={mode === "pageless" ? "One continuous page — no page breaks" : "Paginated like a printed document"}
              >
                <Icon className={styles.icon} aria-hidden />
                <span className={styles.modeLabel}>{label}</span>
              </button>
            ))}
          </div>
        ) : null}
        {editable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const tab = capture().find((item) => item.id === activeRef.current) ?? tabsRef.current[0];
              setPageSetupFor(readPageSetup(tab.data, tab.setup));
            }}
          >
            <FileCog className={styles.icon} aria-hidden />
            Page setup
          </Button>
        ) : null}
      </div>

      <div className={styles.editor}>
        <UniverDoc
          key={`${active.id}:${mountVersion}`}
          data={active.data}
          editable={editable}
          onChange={(getData) => {
            activeGetter.current = getData;
            onChange();
          }}
        />
      </div>

      {pageSetupFor ? (
        <DocPageSetupModal initial={pageSetupFor} applyToAllTabs={tabs.length === 1} onApply={applySetup} onClose={() => setPageSetupFor(null)} />
      ) : null}
    </div>
  );
}
