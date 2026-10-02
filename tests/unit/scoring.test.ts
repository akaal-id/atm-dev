// Run: npm run test:unit
import assert from "node:assert/strict";

import {
  computeScores,
  DEFAULT_SCORING_CONFIG as config,
  lateDays,
  parseScoringConfig,
  qualityOf,
  scoringPeriod,
  taskEffort,
  taskShares,
  type ScoringTask,
} from "@/lib/scoring";

const task = (patch: Partial<ScoringTask>): ScoringTask => ({
  task_id: "t1",
  title: "Task",
  assigned_to: ["a"],
  assigned_by: "lead",
  status: "Finished",
  due_date: "2026-09-10",
  created_at: "2026-09-01T02:00:00Z",
  updated_at: "2026-09-09T02:00:00Z",
  completed_at: "2026-09-09T02:00:00Z",
  handed_off_at: "2026-09-09T02:00:00Z",
  ...patch,
});

const users = [
  { user_id: "a", full_name: "Ana", score_track: "design" },
  { user_id: "b", full_name: "Budi", score_track: "copywriting" },
  { user_id: "c", full_name: "Cici", score_track: "design" },
  { user_id: "lead", full_name: "Lea", score_track: "leader" },
];
const period = { start: "2026-09-01", end: "2026-09-30", today: "2026-10-02" };
const score = (tasks: ScoringTask[], extra: Partial<Parameters<typeof computeScores>[0]> = {}) =>
  computeScores({ tasks, users, attendance: [], ledger: [], config, period, ...extra });
const byId = (rows: ReturnType<typeof computeScores>) => new Map(rows.map((row) => [row.user_id, row]));

const shares = taskShares({ assigned_to: ["a", "b", "c"], pic_user_id: "a" }, config);
const equal = taskShares({ assigned_to: ["a", "b", "c", "a"] }, config);
const custom = taskShares({ assigned_to: ["a", "b"], contribution_shares: { a: 3, b: 1 } }, config);

// A 9-person "whole team" task no longer pays everyone in full.
const team = byId(score([task({ assigned_to: ["a", "b", "c"], work_type_id: "design-kv" })]));
const solo = byId(score([task({ work_type_id: "design-kv" })]));

// Copywriter target is lower than designer's, so equal % for equal relative output.
const fair = byId(
  score([
    task({ task_id: "d", assigned_to: ["a"], effort_points: 20 }),
    task({ task_id: "c", assigned_to: ["b"], effort_points: 15 }),
  ]),
);

const late = byId(score([task({ handed_off_at: "2026-09-14T02:00:00Z", completed_at: "2026-09-15T02:00:00Z" })]));
// Handed off on time, approved late by the leader: no lateness for the worker.
const waitedOnLeader = byId(score([task({ handed_off_at: "2026-09-10T02:00:00Z", completed_at: "2026-09-20T02:00:00Z" })]));
const overdueOpen = byId(score([task({ status: "In Progress", completed_at: "", handed_off_at: "", due_date: "2026-09-20" })]));

const leader = byId(
  score([
    task({ task_id: "x", assigned_to: ["a"], handed_off_at: "2026-09-09T02:00:00Z", completed_at: "2026-09-09T10:00:00Z" }),
    task({ task_id: "y", assigned_to: ["c"], handed_off_at: "2026-09-05T02:00:00Z", completed_at: "2026-09-08T02:00:00Z" }),
  ]),
).get("lead")!;

const discipline = byId(
  score([], {
    attendance: [
      { user_id: "a", date: "2026-09-02", onTime: true, eod: true },
      { user_id: "a", date: "2026-09-03", onTime: false, eod: true },
    ],
    ledger: [{ user_id: "a", source_type: "manual_adjustment", points: 5, created_at: "2026-09-05T02:00:00Z", reason: "bonus" }],
  }),
).get("a")!;

// A leader who briefed nobody can't top the board on attendance alone.
const idleLeader = byId(score([], { attendance: [{ user_id: "lead", date: "2026-09-02", onTime: true, eod: true }] })).get("lead")!;

const parsed = parseScoringConfig(JSON.stringify({ targets: { design: 50 }, picShare: 5, workTypes: [{ id: "x", name: " X ", track: "nope", effort: 99 }] }));
const quarter = scoringPeriod("quarter", "2026-08-15");
const week = scoringPeriod("week", "2026-10-02");

const checks: Array<[string, boolean]> = [
  ["PIC gets 60%", Math.abs(shares.get("a")! - 0.6) < 1e-9 && Math.abs(shares.get("b")! - 0.2) < 1e-9],
  ["equal split, duplicates ignored", equal.size === 3 && Math.abs(equal.get("a")! - 1 / 3) < 1e-9],
  ["custom shares normalised", custom.get("a") === 0.75 && custom.get("b") === 0.25],
  ["effort from work type", taskEffort({ work_type_id: "design-deck" }, config) === 8],
  ["explicit effort wins", taskEffort({ work_type_id: "design-deck", effort_points: 3 }, config) === 3],
  ["unknown type → default effort", taskEffort({ work_type_id: "nope" }, config) === config.defaultEffort],
  ["shared task credit is split", Math.abs(team.get("a")!.stats.credited * 3 - solo.get("a")!.stats.credited) < 0.2],
  ["equal relative output → equal output %", fair.get("a")!.components.output === fair.get("b")!.components.output],
  ["late hand-off lowers timeliness", late.get("a")!.components.timeliness === 40 && lateDays(task({ handed_off_at: "2026-09-14T02:00:00Z" })) === 4],
  ["approval delay is not the worker's fault", waitedOnLeader.get("a")!.components.timeliness === 100],
  ["overdue open task hurts timeliness, no output", overdueOpen.get("a")!.stats.overdueOpen === 1 && overdueOpen.get("a")!.stats.credited === 0],
  ["revisions reduce quality", qualityOf({ revision_count: 2 }, config).multiplier === 0.8 && qualityOf({ revision_count: 9 }, config).multiplier === 0.7],
  ["rating overrides revisions", qualityOf({ revision_count: 3, quality_rating: 5 }, config).score === 100],
  ["leader: team output + review SLA", leader.track === "leader" && leader.components.reviewSla === 50 && leader.stats.teamSize === 2],
  ["idle leader: team output 0, low score", idleLeader.components.teamOutput === 0 && idleLeader.score <= 30],
  ["discipline = punctual 60 + EOD 40", discipline.components.discipline === 70],
  ["manual adjustment applied", discipline.stats.adjustment === 5],
  ["no tasks → quality/timeliness drop out", discipline.components.quality === null && discipline.components.timeliness === null],
  ["config: clamps and fills defaults", parsed.targets.design === 50 && parsed.targets.video === config.targets.video && parsed.picShare === 1],
  ["config: bad work type sanitised", parsed.workTypes[0].name === "X" && parsed.workTypes[0].track === "general" && parsed.workTypes[0].effort === 40],
  ["quarter range", quarter.start === "2026-07-01" && quarter.end === "2026-09-30"],
  ["week range Mon–Sun", week.start === "2026-09-28" && week.end === "2026-10-04"],
];

for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
assert.ok(checks.every(([, ok]) => ok), "all scoring checks pass");
