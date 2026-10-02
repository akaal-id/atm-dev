import styles from "./attendance-history.module.css";

import { Fragment } from "react";

import { AttendancePager, AttendancePeriodNav, pageSlice } from "@/components/app/attendance-period-nav";
import { AttendanceReportButton } from "@/components/app/attendance-report-button";
import { PageHero } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { type AttendanceHistoryRow, formatActive, type HistoryView } from "@/lib/attendance-history";
import { cn } from "@/lib/utils";

export const HISTORY_PAGE_SIZE = 50;

const modeTone = (mode: string) => (mode === "WFO" ? "green" : mode === "WFH" ? "blue" : mode === "Off-site" ? "red" : "neutral");

const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Consecutive rows of the same date, in page order. */
function groupByDate(rows: AttendanceHistoryRow[]) {
  const groups: Array<{ date: string; rows: AttendanceHistoryRow[] }> = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last?.date === row.date) last.rows.push(row);
    else groups.push({ date: row.date, rows: [row] });
  }
  return groups;
}

/** Team attendance for one day / week / month, grouped by date and paged; filters live in the URL. */
export function AttendanceHistoryView({ rows, view, anchor, page }: { rows: AttendanceHistoryRow[]; view: HistoryView; anchor: string; page: number }) {
  const state = { basePath: "/attendance/history", view, anchor };
  const { current, pages, rows: visible } = pageSlice(rows, page, HISTORY_PAGE_SIZE);
  const counts = { WFO: 0, WFH: 0, "Off-site": 0 } as Record<string, number>;
  rows.forEach((row) => row.work_mode in counts && (counts[row.work_mode] += 1));
  const people = new Set(rows.map((row) => row.user_id)).size;

  return (
    <div className={styles.root}>
      <PageHero eyebrow="Attendance" title="Attendance history" description="Team attendance by day, week, or month. Export any range as PDF." actions={<AttendanceReportButton />} />

      <Card>
        <CardHeader className={styles.header}>
          <AttendancePeriodNav state={state} />
          <div className={styles.summary}>
            <span>
              {rows.length} records · {people} {people === 1 ? "person" : "people"}
            </span>
            <Badge tone="green">WFO {counts.WFO}</Badge>
            <Badge tone="blue">WFH {counts.WFH}</Badge>
            <Badge tone="red">Off-site {counts["Off-site"]}</Badge>
          </div>
        </CardHeader>
        <CardBody className={styles.tableWrap}>
          {visible.length === 0 ? (
            <p className={styles.empty}>No attendance in this period.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Time</th>
                  <th>Active</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>EOD summary</th>
                </tr>
              </thead>
              <tbody>
                {groupByDate(visible).map((group) => (
                  <Fragment key={group.date}>
                    <tr className={styles.groupRow}>
                      <th colSpan={6} scope="rowgroup">
                        {dayLabel.format(new Date(`${group.date}T00:00:00Z`))}
                        <span className={styles.groupCount}>{group.rows.length}</span>
                      </th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={`${row.user_id}:${row.date}`} className={styles.row}>
                        <td className={styles.employee}>
                          <div className={styles.person}>
                            <Avatar name={row.name} image={row.photo || undefined} size="sm" />
                            <span className={styles.name}>{row.name}</span>
                          </div>
                        </td>
                        <td className={styles.time}>
                          {row.clock_in || "–"}
                          <span className={styles.arrow}>→</span>
                          {row.clock_out || <span className={styles.muted}>open</span>}
                          {row.active_minutes ? <span className={styles.timeActive}> · {formatActive(row.active_minutes)}</span> : null}
                        </td>
                        <td className={styles.active}>{row.active_minutes ? formatActive(row.active_minutes) : <span className={styles.muted}>–</span>}</td>
                        <td className={cn(styles.mode, !row.work_mode && styles.modeEmpty)}>{row.work_mode ? <Badge tone={modeTone(row.work_mode)}>{row.work_mode}</Badge> : <span className={styles.muted}>–</span>}</td>
                        <td className={styles.status}>{row.status ? <StatusPill status={row.status} /> : null}</td>
                        <td className={styles.eodCell}>
                          {row.eod ? (
                            <span className={styles.eod} title={row.eod}>
                              {row.eod}
                            </span>
                          ) : (
                            <span className={styles.muted}>No summary</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
        {pages > 1 ? (
          <div className={styles.footer}>
            <span className={styles.muted}>
              Page {current} of {pages}
            </span>
            <AttendancePager state={state} current={current} pages={pages} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
