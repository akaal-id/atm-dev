"use client";

import styles from "./attendance-report-button.module.css";

import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { type AttendanceHistoryRow, daysBetween, formatActive, jakartaToday, MAX_REPORT_DAYS, presetRange, reportPresets, type ReportPreset } from "@/lib/attendance-history";
import { requestJson } from "@/lib/request-json";
import { cn } from "@/lib/utils";

type Choice = ReportPreset | "custom";

/** Report rows → a one-sheet workbook, so the proven spreadsheet PDF exporter renders it. */
function reportWorkbook(rows: AttendanceHistoryRow[], start: string, end: string) {
  const headers = ["Date", "Employee", "Clock in", "Clock out", "Active", "Mode", "Status", "EOD summary"];
  const widths = [88, 150, 64, 70, 70, 70, 96, 360];
  const head = { bl: 1, bg: { rgb: "#1d4ed8" }, cl: { rgb: "#ffffff" }, vt: 2 };
  const cellData: Record<number, Record<number, { v: string | number; s?: object }>> = {
    0: { 0: { v: `Attendance report ${start} – ${end} · ${rows.length} records`, s: { bl: 1, fs: 12 } } },
    1: Object.fromEntries(headers.map((header, col) => [col, { v: header, s: head }])),
  };
  rows.forEach((row, index) => {
    const values = [row.date, row.name, row.clock_in || "-", row.clock_out || "-", formatActive(row.active_minutes), row.work_mode || "-", row.status || "-", row.eod || "-"];
    cellData[index + 2] = Object.fromEntries(values.map((value, col) => [col, { v: value, s: { vt: 1, ...(col === 7 ? { tb: 3 } : {}) } }]));
  });
  return {
    sheetOrder: ["report"],
    sheets: {
      report: {
        name: "Attendance",
        cellData,
        mergeData: [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 7 }],
        columnData: Object.fromEntries(widths.map((w, col) => [col, { w }])),
        rowData: { 0: { h: 30 }, 1: { h: 26 } },
      },
    },
  };
}

/** "Export PDF" with presets (this month, last 30 days, 3 / 6 months) or a free date range. */
export function AttendanceReportButton() {
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>("this_month");
  const [custom, setCustom] = useState({ start: "", end: jakartaToday() });
  const [busy, setBusy] = useState(false);

  const range = choice === "custom" ? custom : presetRange(choice);
  const valid = Boolean(range.start && range.end && range.end >= range.start && daysBetween(range.start, range.end) <= MAX_REPORT_DAYS);

  async function exportPdf() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const rows = await requestJson<AttendanceHistoryRow[]>(`/api/attendance/report?start=${range.start}&end=${range.end}`, "GET");
      if (!rows.length) throw new Error("No attendance in this range.");
      const { downloadSheetPdf } = await import("@/lib/sheet-pdf-export");
      await downloadSheetPdf(`Attendance ${range.start} to ${range.end}`, reportWorkbook(rows, range.start, range.end) as never);
      setOpen(false);
    } catch (error) {
      pushToast({ tone: "error", title: "Export failed", description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileDown className={styles.icon} aria-hidden />
        Export PDF
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Attendance report" eyebrow="Export PDF" className={styles.panel}>
        <div className={styles.body}>
          <div className={styles.chips} role="radiogroup" aria-label="Period">
            {[...reportPresets, { id: "custom" as const, label: "Custom range" }].map((option) => (
              <button key={option.id} type="button" role="radio" aria-checked={choice === option.id} className={cn(styles.chip, choice === option.id && styles.chipActive)} onClick={() => setChoice(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
          {choice === "custom" ? (
            <div className={styles.row}>
              <div className={styles.field}>
                <span className={styles.label}>From</span>
                <DatePickerField variant="form" value={custom.start} onChange={(start) => setCustom({ ...custom, start })} />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>To</span>
                <DatePickerField variant="form" value={custom.end} onChange={(end) => setCustom({ ...custom, end })} />
              </div>
            </div>
          ) : null}
          <p className={styles.hint}>
            {range.start && range.end ? `${range.start} → ${range.end}` : "Pick both dates"}
            {range.start && range.end && !valid ? ` · up to ${MAX_REPORT_DAYS} days, end after start` : ""}
          </p>
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void exportPdf()} disabled={!valid || busy}>
              {busy ? <Loader2 className={styles.spin} aria-hidden /> : <FileDown className={styles.icon} aria-hidden />}
              Download PDF
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
