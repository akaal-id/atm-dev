import styles from "./leaderboard.module.css";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Crown, Minus, Sparkles } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { type LeaderboardPeriodView, scoreTracks, trackLabel } from "@/lib/scoring";
import type { LeaderboardData } from "@/lib/server/scoring";
import { cn, formatDate } from "@/lib/utils";

type Row = LeaderboardData["rows"][number];
type Filters = { view: LeaderboardPeriodView; date: string; track: string; dept: string };

const views: Array<{ id: LeaderboardPeriodView; label: string }> = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
];

function href(filters: Filters, patch: Partial<Filters>) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams({ view: next.view, date: next.date });
  if (next.track) params.set("track", next.track);
  if (next.dept) params.set("dept", next.dept);
  return `/leaderboard?${params.toString()}`;
}

type Tone = "Good" | "Mid" | "Low" | "None";
const toneOf = (score: number | null): Tone => (score === null ? "None" : score >= 80 ? "Good" : score >= 60 ? "Mid" : "Low");
/** Text colour for a 0–100 value. */
const tone = (score: number | null) => styles[`text${toneOf(score)}`];
/** Bar fill colour for a 0–100 value. */
const fill = (score: number | null) => styles[`fill${toneOf(score)}`];
const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value)}%`);

function periodLabel(view: LeaderboardPeriodView, start: string, end: string) {
  if (view === "month") return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${start}T00:00:00Z`));
  if (view === "quarter") return `Q${Math.floor(Number(start.slice(5, 7)) / 3) + 1} ${start.slice(0, 4)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function Movement({ row }: { row: Row }) {
  if (row.previousRank === null) return <span className={styles.moveNew}>new</span>;
  const delta = row.previousRank - row.rank;
  if (delta === 0) return <Minus className={styles.moveSame} aria-label="No change" />;
  return delta > 0 ? (
    <span className={styles.moveUp} aria-label={`Up ${delta}`}>
      <ArrowUp />
      {delta}
    </span>
  ) : (
    <span className={styles.moveDown} aria-label={`Down ${-delta}`}>
      <ArrowDown />
      {-delta}
    </span>
  );
}

function Bar({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className={styles.bar}>
      <div className={styles.barHead}>
        <span>{label}</span>
        <strong className={tone(value)}>{pct(value)}</strong>
      </div>
      <div className={styles.barTrack}>
        <span className={cn(styles.barFill, fill(value))} style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
      </div>
      {hint ? <p className={styles.barHint}>{hint}</p> : null}
    </div>
  );
}

function componentBars(row: Row) {
  const c = row.components;
  if (row.track === "leader") {
    return [
      { label: "Team output", value: c.teamOutput, hint: `${row.stats.teamSize} ${row.stats.teamSize === 1 ? "person" : "people"} briefed` },
      { label: "Review within SLA", value: c.reviewSla, hint: `${row.stats.reviewed} hand-offs reviewed` },
      { label: "Team on time", value: c.teamOnTime },
      { label: "Discipline", value: c.discipline, hint: row.stats.attendanceDays ? `${row.stats.attendanceDays} workdays` : "No attendance data" },
    ];
  }
  return [
    { label: "Output vs target", value: c.output, hint: `${row.stats.credited} / ${row.stats.target} effort pts` },
    { label: "Quality", value: c.quality, hint: row.stats.firstTryRate === null ? undefined : `${Math.round(row.stats.firstTryRate)}% approved first try` },
    { label: "Timeliness", value: c.timeliness, hint: row.stats.onTimeRate === null ? undefined : `${Math.round(row.stats.onTimeRate)}% handed off on time` },
    { label: "Discipline", value: c.discipline, hint: row.stats.attendanceDays ? `${row.stats.attendanceDays} workdays` : "No attendance data" },
  ];
}

function Breakdown({ row }: { row: Row }) {
  return (
    <div className={styles.breakdown}>
      <div className={styles.breakdownBars}>
        {componentBars(row).map((bar) => (
          <Bar key={bar.label} {...bar} />
        ))}
      </div>
      {row.tasks.length ? (
        <table className={styles.taskTable}>
          <thead>
            <tr>
              <th>Task</th>
              <th>Effort</th>
              <th>Share</th>
              <th>Time</th>
              <th>Quality</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {row.tasks.slice(0, 12).map((task) => (
              <tr key={`${task.task_id}:${task.status}`}>
                <td>
                  <Link href={`/tasks/${task.task_id}`} className={styles.taskLink}>
                    {task.title}
                  </Link>
                  {task.status === "overdue" ? <span className={styles.overdue}>overdue {task.lateDays}d</span> : null}
                </td>
                <td>{task.effort}</td>
                <td>{Math.round(task.share * 100)}%</td>
                <td>{task.status === "overdue" ? "—" : `×${task.timeliness}`}</td>
                <td>{task.status === "overdue" ? "—" : `×${task.quality}`}</td>
                <td>
                  <strong>{task.points}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.muted}>No finished tasks in this period.</p>
      )}
      {row.tasks.length > 12 ? <p className={styles.muted}>+{row.tasks.length - 12} more tasks</p> : null}
      {row.stats.adjustment ? (
        <p className={styles.muted}>
          Manual adjustment: {row.stats.adjustment > 0 ? "+" : ""}
          {row.stats.adjustment}
        </p>
      ) : null}
    </div>
  );
}

/** Leaderboard v2: monthly season, normalised per track, with a personal scorecard and a transparent breakdown. */
export function LeaderboardView({ data, filters, currentUserId }: { data: LeaderboardData; filters: Filters; currentUserId: string }) {
  const { period, config } = data;
  const rows = data.rows
    .filter((row) => (filters.track ? row.track === filters.track : true) && (filters.dept ? row.department_id === filters.dept : true))
    .map((row, index) => ({ ...row, boardRank: index + 1 }));
  const me = data.rows.find((row) => row.user_id === currentUserId);
  const podium = rows.filter((row) => row.score > 0).slice(0, 3);
  const departmentName = new Map(data.departments.map((department) => [department.department_id, department.department_name]));
  const active = rows.filter((row) => row.stats.tasksDone || row.stats.attendanceDays || row.stats.reviewed);

  return (
    <div className={styles.root}>
      <Card>
        <CardBody className={styles.toolbar}>
          <div className={styles.segment} role="tablist" aria-label="Period">
            {views.map((option) => (
              <Link key={option.id} href={href(filters, { view: option.id })} role="tab" aria-selected={option.id === filters.view} className={cn(styles.segmentItem, option.id === filters.view && styles.segmentActive)}>
                {option.label}
              </Link>
            ))}
          </div>
          <div className={styles.nav}>
            <Link href={href(filters, { date: period.prev })} className={styles.navButton} aria-label="Previous period">
              <ChevronLeft />
            </Link>
            <span className={styles.period}>{periodLabel(filters.view, period.start, period.end)}</span>
            <Link href={href(filters, { date: period.next })} className={styles.navButton} aria-label="Next period">
              <ChevronRight />
            </Link>
          </div>
          <div className={styles.chips} role="tablist" aria-label="Board">
            <Link href={href(filters, { track: "" })} className={cn(styles.chip, !filters.track && styles.chipActive)}>
              Overall
            </Link>
            {scoreTracks.map((track) => (
              <Link key={track.id} href={href(filters, { track: track.id })} className={cn(styles.chip, filters.track === track.id && styles.chipActive)}>
                {track.label}
              </Link>
            ))}
          </div>
          {data.departments.length > 1 ? (
            <div className={styles.chips} aria-label="Department">
              <Link href={href(filters, { dept: "" })} className={cn(styles.chip, styles.chipSmall, !filters.dept && styles.chipActive)}>
                All departments
              </Link>
              {data.departments.map((department) => (
                <Link key={department.department_id} href={href(filters, { dept: department.department_id })} className={cn(styles.chip, styles.chipSmall, filters.dept === department.department_id && styles.chipActive)}>
                  {department.department_name}
                </Link>
              ))}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {me ? (
        <Card>
          <CardBody className={styles.scorecard}>
            <div className={styles.scoreSide}>
              <p className={styles.eyebrow}>My scorecard</p>
              <div className={cn(styles.bigScore, tone(me.score))}>
                {me.score}
                <span>/100</span>
              </div>
              <p className={styles.rankLine}>
                Rank #{me.rank} of {data.rows.length} <Movement row={me} />
              </p>
              <p className={styles.muted}>
                {trackLabel(me.track)} · {me.xp.toLocaleString("en-US")} XP lifetime
              </p>
            </div>
            <div className={styles.scoreBars}>
              {componentBars(me).map((bar) => (
                <Bar key={bar.label} {...bar} />
              ))}
            </div>
            <div className={styles.hints}>
              <p className={styles.eyebrow}>How to improve</p>
              {me.hints.length ? (
                <ul>
                  {me.hints.slice(0, 4).map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>Nothing to fix — keep it up.</p>
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {podium.length ? (
        <div className={styles.podium}>
          {podium.map((row) => (
            <div key={row.user_id} className={cn(styles.podiumCard, row.boardRank === 1 && styles.podiumFirst)} style={{ order: row.boardRank === 1 ? 2 : row.boardRank === 2 ? 1 : 3 }}>
              <span className={styles.podiumRank}>
                {row.boardRank === 1 ? <Crown aria-hidden /> : null}#{row.boardRank}
              </span>
              <Avatar name={row.name} image={row.photo || undefined} size="lg" />
              <p className={styles.podiumName}>{row.name}</p>
              <p className={styles.muted}>{trackLabel(row.track)}</p>
              <p className={cn(styles.podiumScore, tone(row.score))}>{row.score}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader className={styles.rankingHead}>
          <h2 className={styles.sectionTitle}>Ranking</h2>
          <p className={styles.muted}>
            {active.length} of {rows.length} people active · click a row for the breakdown
          </p>
        </CardHeader>
        <CardBody className={styles.ranking}>
          <div className={cn(styles.rankRow, styles.rankHeader)} aria-hidden>
            <span>#</span>
            <span>Person</span>
            <span>Score</span>
            <span>Output</span>
            <span>On time</span>
            <span>First try</span>
            <span>Discipline</span>
            <span>Tasks</span>
          </div>
          {rows.length === 0 ? <p className={styles.empty}>Nobody on this board yet.</p> : null}
          {rows.map((row) => (
            <details key={row.user_id} className={cn(styles.rankItem, row.user_id === currentUserId && styles.rankMine)}>
              <summary className={styles.rankRow}>
                <span className={styles.rankCell}>
                  <strong>{row.boardRank}</strong>
                  <Movement row={row} />
                </span>
                <span className={styles.person}>
                  <Avatar name={row.name} image={row.photo || undefined} size="sm" />
                  <span className={styles.personText}>
                    <span className={styles.personName}>{row.name}</span>
                    <span className={styles.muted}>
                      {trackLabel(row.track)}
                      {departmentName.get(row.department_id) ? ` · ${departmentName.get(row.department_id)}` : ""}
                    </span>
                  </span>
                </span>
                <span className={styles.scoreCell}>
                  <strong className={tone(row.score)}>{row.score}</strong>
                  <span className={styles.scoreTrack}>
                    <span className={cn(styles.barFill, fill(row.score))} style={{ width: `${row.score}%` }} />
                  </span>
                </span>
                <span className={styles.metric} data-label="Output">
                  {row.track === "leader" ? pct(row.components.teamOutput) : pct(row.components.output)}
                </span>
                <span className={styles.metric} data-label="On time">
                  {row.track === "leader" ? pct(row.components.teamOnTime) : pct(row.stats.onTimeRate)}
                </span>
                <span className={styles.metric} data-label="First try">
                  {row.track === "leader" ? pct(row.components.reviewSla) : pct(row.stats.firstTryRate)}
                </span>
                <span className={styles.metric} data-label="Discipline">
                  {pct(row.components.discipline)}
                </span>
                <span className={styles.metric} data-label="Tasks">
                  {row.stats.tasksDone}
                  {row.stats.overdueOpen ? <span className={styles.overdue}> +{row.stats.overdueOpen} overdue</span> : null}
                </span>
              </summary>
              <Breakdown row={row} />
            </details>
          ))}
        </CardBody>
      </Card>

      <Card>
        <details className={styles.rules}>
          <summary className={styles.rulesSummary}>
            <Sparkles aria-hidden />
            How scoring works
          </summary>
          <div className={styles.rulesBody}>
            <div>
              <h3>Score (0–100)</h3>
              <p>
                Output {config.weights.output}% · Quality {config.weights.quality}% · Timeliness {config.weights.timeliness}% · Discipline {config.weights.discipline}%. Leaders: team output {config.leaderWeights.teamOutput}%, reviews within {config.reviewSlaHours} h {config.leaderWeights.reviewSla}%, team on time {config.leaderWeights.teamOnTime}%, discipline {config.leaderWeights.discipline}%.
              </p>
              <p>Ranking is by score, so every track competes fairly. The season resets each month; lifetime XP keeps the long-term total.</p>
            </div>
            <div>
              <h3>Task points</h3>
              <p>
                Each task has effort points from its work type. They are split between assignees — the PIC gets {Math.round(config.picShare * 100)}%, the rest share the remainder — then multiplied by timeliness (early ×{config.timeliness.early}, on time ×{config.timeliness.onTime}, 1–2 days late ×{config.timeliness.late}, later ×{config.timeliness.veryLate}) and quality (first-try approval ×{config.quality.firstTry}, −{Math.round(config.quality.perRevision * 100)}% per revision, floor ×{config.quality.floor}). Timeliness is judged when you hand the task off; time waiting for approval doesn&apos;t count against you.
              </p>
            </div>
            <div>
              <h3>Targets per {filters.view === "week" ? "30 days (pro-rated)" : "30 days"}</h3>
              <ul className={styles.targetList}>
                {scoreTracks
                  .filter((track) => track.id !== "leader")
                  .map((track) => (
                    <li key={track.id}>
                      {track.label}: <strong>{config.targets[track.id]}</strong> effort pts
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h3>Work types</h3>
              <ul className={styles.typeList}>
                {config.workTypes
                  .filter((type) => type.active)
                  .map((type) => (
                    <li key={type.id}>
                      <span>{type.name}</span>
                      <span className={styles.muted}>{trackLabel(type.track)}</span>
                      <strong>{type.effort}</strong>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </details>
      </Card>
    </div>
  );
}
