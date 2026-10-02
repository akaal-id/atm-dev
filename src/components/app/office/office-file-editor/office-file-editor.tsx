"use client";

import styles from "./office-file-editor.module.css";

import { ArrowLeft, Download, FileSpreadsheet, FileText, Loader2, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SheetSnapshot } from "@/components/app/office/univer-sheet/univer-sheet";
import { useTenant } from "@/components/app/tenant-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { downloadXlsx } from "@/lib/document-export";
import type { DocSnapshot } from "@/lib/office-doc";
import { requestJson } from "@/lib/request-json";
import type { OfficeFile } from "@/lib/types/office";

const UniverSheet = dynamic(() => import("@/components/app/office/univer-sheet").then((module) => module.UniverSheet), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <Loader2 className={styles.spinner} aria-hidden /> Loading spreadsheet…
    </div>
  ),
});

const OfficeDocEditor = dynamic(() => import("@/components/app/office/office-doc-editor").then((module) => module.OfficeDocEditor), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <Loader2 className={styles.spinner} aria-hidden /> Loading document…
    </div>
  ),
});

type SaveState = "saved" | "pending" | "saving" | "error";
const AUTOSAVE_MS = 1200;

export function OfficeFileEditor({
  file,
  canEdit,
  canDelete,
  locationLabel,
  backHref,
}: {
  file: OfficeFile;
  canEdit: boolean;
  canDelete: boolean;
  /** "Personal notes" or "<project> / <folder>". */
  locationLabel: string;
  /** App path back to the file's location in the Office browser. */
  backHref: string;
}) {
  const router = useRouter();
  const tenant = useTenant();
  const { pushToast } = useToast();
  const [title, setTitle] = useState(file.title);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<number | null>(null);
  const latest = useRef<{ getSnapshot?: () => SheetSnapshot; getDoc?: () => DocSnapshot }>({});
  const bindDoc = useCallback((getDoc: () => DocSnapshot) => {
    latest.current.getDoc = getDoc;
  }, []);

  const persist = useCallback(async () => {
    timer.current = null;
    setSaveState("saving");
    try {
      const snapshot = file.type === "sheet" ? latest.current.getSnapshot?.() ?? file.snapshot ?? {} : latest.current.getDoc?.();
      if (!snapshot) throw new Error("The document is still loading.");
      const body = { snapshot };
      await requestJson(`/api/office/${file.file_id}`, "PATCH", body);
      // Another edit may have arrived while saving; it schedules its own save.
      setSaveState((state) => (state === "saving" ? "saved" : state));
    } catch (error) {
      setSaveState("error");
      pushToast({ tone: "error", title: "Autosave failed", description: error instanceof Error ? error.message : "Your latest changes are not saved yet." });
    }
  }, [file.file_id, file.snapshot, file.type, pushToast]);

  const schedule = useCallback(() => {
    setSaveState("pending");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void persist(), AUTOSAVE_MS);
  }, [persist]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (saveState === "saved") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function rename() {
    const next = title.trim();
    if (!next) {
      setTitle(file.title);
      return;
    }
    if (next === file.title) return;
    try {
      await requestJson(`/api/office/${file.file_id}`, "PATCH", { title: next });
      router.refresh();
    } catch (error) {
      setTitle(file.title);
      pushToast({ tone: "error", title: "Could not rename", description: error instanceof Error ? error.message : undefined });
    }
  }

  async function exportAs(format: "xlsx" | "docx" | "pdf") {
    setExporting(true);
    try {
      if (file.type === "sheet") {
        const snapshot = latest.current.getSnapshot?.() ?? file.snapshot;
        if (format === "xlsx") {
          await downloadXlsx(title, snapshot as Parameters<typeof downloadXlsx>[1]);
        } else {
          const { downloadSheetPdf } = await import("@/lib/sheet-pdf-export");
          await downloadSheetPdf(title, snapshot as Parameters<typeof downloadSheetPdf>[1]);
        }
      } else {
        const doc = latest.current.getDoc?.();
        if (!doc) throw new Error("The document is still loading.");
        const { downloadDocumentDocx, downloadDocumentPdf } = await import("@/lib/office-doc-export");
        await (format === "docx" ? downloadDocumentDocx(title, doc.tabs) : downloadDocumentPdf(title, doc.tabs));
      }
    } catch (error) {
      pushToast({ tone: "error", title: "Export failed", description: error instanceof Error ? error.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  async function remove() {
    try {
      await requestJson(`/api/office/${file.file_id}`, "DELETE");
      pushToast({ tone: "success", title: `Deleted “${file.title}”` });
      router.push(tenant.href(backHref));
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "Could not delete", description: error instanceof Error ? error.message : undefined });
    }
  }

  const statusText = { saved: "All changes saved", pending: "Unsaved changes…", saving: "Saving…", error: "Not saved — retrying on next edit" }[saveState];
  const TypeIcon = file.type === "sheet" ? FileSpreadsheet : FileText;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href={tenant.href(backHref)} className={styles.back}>
          <ArrowLeft className={styles.icon} aria-hidden />
          {locationLabel}
        </Link>
        <div className={styles.titleRow}>
          <TypeIcon className={styles.typeIcon} aria-hidden />
          {canEdit ? (
            <input
              className={styles.titleInput}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => void rename()}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              aria-label="File title"
              maxLength={200}
            />
          ) : (
            <h1 className={styles.title}>{title}</h1>
          )}
          <span className={saveState === "error" ? styles.statusError : styles.status} role="status">
            {canEdit ? statusText : "View only"}
          </span>
          <div className={styles.actions}>
            {file.type === "sheet" ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => void exportAs("xlsx")} disabled={exporting}>
                  <Download className={styles.icon} aria-hidden />
                  Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void exportAs("pdf")} disabled={exporting}>
                  <Download className={styles.icon} aria-hidden />
                  PDF
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => void exportAs("docx")} disabled={exporting}>
                  <Download className={styles.icon} aria-hidden />
                  DOCX
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void exportAs("pdf")} disabled={exporting}>
                  <Download className={styles.icon} aria-hidden />
                  PDF
                </Button>
              </>
            )}
            {canDelete ? (
              confirmDelete ? (
                <Button type="button" variant="destructiveSolid" size="sm" onClick={() => void remove()}>
                  Confirm delete
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(true)} aria-label="Delete file">
                  <Trash2 className={styles.icon} />
                </Button>
              )
            ) : null}
          </div>
        </div>
      </header>

      <div className={styles.body}>
        {file.type === "sheet" ? (
          <UniverSheet
            snapshot={file.snapshot}
            title={file.title}
            editable={canEdit}
            onChange={(getSnapshot) => {
              latest.current.getSnapshot = getSnapshot;
              schedule();
            }}
          />
        ) : (
          <OfficeDocEditor snapshot={file.snapshot} legacyHtml={file.content} title={file.title} editable={canEdit} bindSnapshot={bindDoc} onChange={schedule} />
        )}
      </div>
    </div>
  );
}
