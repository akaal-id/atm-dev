/**
 * Leaderboard v2 scoring — pure functions shared by server and client (no I/O).
 * Plan and rationale: docs/leaderboard-plan.md.
 *
 * Each task carries effort points (from its work type, overridable). Credit is split between
 * its assignees (PIC 60% by default), then scaled by timeliness (judged at hand-off) and quality
 * (revisions / reviewer rating). People are ranked on % of their track's target, so a copywriter
 * and a designer compete fairly; leaders are scored on how their team does.
 */

export type ScoreTrack = "design" | "copywriting" | "video" | "account" | "leader" | "general";

export const scoreTracks: Array<{ id: ScoreTrack; label: string }> = [
  { id: "design", label: "Design" },
  { id: "copywriting", label: "Copywriting" },
  { id: "video", label: "Video & Motion" },
  { id: "account", label: "Account & Social" },
  { id: "leader", label: "Leader / Manager" },
  { id: "general", label: "General" },
];

export const trackLabel = (track: string) => scoreTracks.find((entry) => entry.id === track)?.label ?? "General";

export function isScoreTrack(value: unknown): value is ScoreTrack {
  return scoreTracks.some((entry) => entry.id === value);
}

export type WorkType = { id: string; name: string; track: ScoreTrack; effort: number; active: boolean };

export type ScoringConfig = {
  workTypes: WorkType[];
  /** Effort points expected per track per 30 days. */
  targets: Record<ScoreTrack, number>;
  /** Individual contributors; percentages, summing to 100. */
  weights: { output: number; quality: number; timeliness: number; discipline: number };
  /** Leaders; percentages, summing to 100. */
  leaderWeights: { teamOutput: number; reviewSla: number; teamOnTime: number; discipline: number };
  /** PIC's share of a multi-assignee task (the rest is split equally). */
  picShare: number;
  timeliness: { early: number; onTime: number; late: number; veryLate: number };
  quality: { firstTry: number; perRevision: number; floor: number };
  reviewSlaHours: number;
  defaultEffort: number;
  /** Output % is capped here so one huge month can't dominate. */
  outputCap: number;
  /** Discipline points lost per Off-site day without an approved permit. */
  offsitePenalty: number;
};

const workType = (id: string, name: string, track: ScoreTrack, effort: number): WorkType => ({ id, name, track, effort, active: true });

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  workTypes: [
    workType("design-feed", "Single feed / story design", "design", 2),
    workType("design-carousel", "Carousel design", "design", 3),
    workType("design-kv", "Key visual / poster", "design", 5),
    workType("design-deck", "Offering / pitch deck", "design", 8),
    workType("design-web", "Website page design", "design", 5),
    workType("design-brand", "Logo / branding", "design", 8),
    workType("design-revision", "Minor design revision", "design", 1),
    workType("copy-caption", "Caption", "copywriting", 1),
    workType("copy-script", "Script / long copy", "copywriting", 3),
    workType("copy-article", "Article / blog", "copywriting", 5),
    workType("copy-deck", "Deck copy & storyline", "copywriting", 3),
    workType("video-reel", "Reel / short motion", "video", 5),
    workType("video-edit", "Long video edit", "video", 8),
    workType("video-shoot", "Shoot / production day", "video", 5),
    workType("account-posting", "Posting & scheduling", "account", 1),
    workType("account-report", "Performance report", "account", 3),
    workType("account-brief", "Client meeting / brief", "account", 2),
    workType("web-dev", "Website development / update", "general", 5),
    workType("general-admin", "Admin / small task", "general", 1),
    workType("general-other", "Other", "general", 2),
  ],
  targets: { design: 40, copywriting: 30, video: 35, account: 30, leader: 0, general: 30 },
  weights: { output: 50, quality: 20, timeliness: 20, discipline: 10 },
  leaderWeights: { teamOutput: 40, reviewSla: 25, teamOnTime: 20, discipline: 15 },
  picShare: 0.6,
  timeliness: { early: 1.1, onTime: 1, late: 0.8, veryLate: 0.6 },
  quality: { firstTry: 1.1, perRevision: 0.1, floor: 0.7 },
  reviewSlaHours: 24,
  defaultEffort: 2,
  outputCap: 120,
  offsitePenalty: 20,
};

const num = (value: unknown, fallback: number, min = -Infinity, max = Infinity) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

/** Settings JSON → full config; anything missing or invalid falls back to the defaults. */
export function parseScoringConfig(raw: unknown): ScoringConfig {
  let value: Partial<ScoringConfig> = {};
  if (typeof raw === "string" && raw.trim()) {
    try {
      value = JSON.parse(raw) as Partial<ScoringConfig>;
    } catch {
      value = {};
    }
  } else if (raw && typeof raw === "object") {
    value = raw as Partial<ScoringConfig>;
  }
  const d = DEFAULT_SCORING_CONFIG;
  const workTypes = Array.isArray(value.workTypes)
    ? value.workTypes
        .filter((entry): entry is WorkType => Boolean(entry && typeof entry.id === "string" && entry.id && typeof entry.name === "string"))
        .map((entry) => ({
          id: entry.id,
          name: entry.name.trim().slice(0, 80),
          track: isScoreTrack(entry.track) ? entry.track : "general",
          effort: num(entry.effort, d.defaultEffort, 0.5, 40),
          active: entry.active !== false,
        }))
    : d.workTypes;
  const pick = <T extends Record<string, number>>(defaults: T, given: unknown, min: number, max: number) =>
    Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, num((given as Record<string, unknown> | undefined)?.[key], fallback, min, max)])) as T;

  return {
    workTypes,
    targets: pick(d.targets, value.targets, 0, 1000),
    weights: pick(d.weights, value.weights, 0, 100),
    leaderWeights: pick(d.leaderWeights, value.leaderWeights, 0, 100),
    picShare: num(value.picShare, d.picShare, 0, 1),
    timeliness: pick(d.timeliness, value.timeliness, 0, 2),
    quality: pick(d.quality, value.quality, 0, 2),
    reviewSlaHours: num(value.reviewSlaHours, d.reviewSlaHours, 1, 240),
    defaultEffort: num(value.defaultEffort, d.defaultEffort, 0.5, 40),
    outputCap: num(value.outputCap, d.outputCap, 100, 300),
    offsitePenalty: num(value.offsitePenalty, d.offsitePenalty, 0, 100),
  };
}

// ---------------------------------------------------------------------------------------------
// Inputs

export type ScoringTask = {
  task_id: string;
  title: string;
  assigned_to: string[];
  assigned_by: string;
  status: string;
  due_date: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  handed_off_at?: string;
  work_type_id?: string;
  effort_points?: number | null;
  pic_user_id?: string;
  contribution_shares?: Record<string, number>;
  revision_count?: number;
  quality_rating?: number | null;
};

export type ScoringUser = { user_id: string; full_name: string; score_track?: string; employment_status?: string; department_id?: string };

/** One workday: punctual clock-in and whether an EOD summary was written. */
export type AttendanceDay = { user_id: string; date: string; onTime: boolean; eod: boolean };

/** Ledger rows that still matter in v2: manual adjustments and Off-site penalties. */
export type LedgerEntry = { user_id: string; source_type: string; points: number; created_at: string; reason: string };

export type ScoringPeriod = { start: string; end: string; today: string };

// ---------------------------------------------------------------------------------------------
// Helpers

export const DONE_STATUSES = new Set(["Finished", "Done", "Approved", "Completed"]);

/** YYYY-MM-DD in Asia/Jakarta for an ISO timestamp (date-only strings pass through). */
export function jakartaDate(value: string | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(time));
}

const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
export const daysInRange = (start: string, end: string) => dayNumber(end) - dayNumber(start) + 1;

export function defaultTrack(user: Pick<ScoringUser, "score_track" | "employment_status">): ScoreTrack {
  if (isScoreTrack(user.score_track)) return user.score_track;
  return user.employment_status === "Leader" || user.employment_status === "Manager" ? "leader" : "general";
}

/** Effort of a task: explicit override, else its work type, else the default. */
export function taskEffort(task: Pick<ScoringTask, "effort_points" | "work_type_id">, config: ScoringConfig) {
  const explicit = Number(task.effort_points);
  if (task.effort_points !== null && task.effort_points !== undefined && Number.isFinite(explicit) && explicit > 0) return explicit;
  return config.workTypes.find((entry) => entry.id === task.work_type_id)?.effort ?? config.defaultEffort;
}

/** Each assignee's share of the task (sums to 1): custom shares, else PIC + equal split, else equal. */
export function taskShares(task: Pick<ScoringTask, "assigned_to" | "pic_user_id" | "contribution_shares">, config: ScoringConfig): Map<string, number> {
  const assignees = [...new Set(task.assigned_to.filter(Boolean))];
  const shares = new Map<string, number>();
  if (assignees.length === 0) return shares;

  const custom = task.contribution_shares ?? {};
  const customTotal = assignees.reduce((sum, id) => sum + Math.max(0, Number(custom[id]) || 0), 0);
  if (customTotal > 0) {
    assignees.forEach((id) => shares.set(id, Math.max(0, Number(custom[id]) || 0) / customTotal));
    return shares;
  }

  if (task.pic_user_id && assignees.includes(task.pic_user_id) && assignees.length > 1) {
    const rest = (1 - config.picShare) / (assignees.length - 1);
    assignees.forEach((id) => shares.set(id, id === task.pic_user_id ? config.picShare : rest));
    return shares;
  }

  assignees.forEach((id) => shares.set(id, 1 / assignees.length));
  return shares;
}

/** Date the task counts in: completion for finished work. */
export const taskDoneDate = (task: ScoringTask) => jakartaDate(task.completed_at || task.updated_at);

/** Days late at hand-off (negative = early). Waiting for approval doesn't count against the worker. */
export function lateDays(task: ScoringTask) {
  if (!task.due_date) return 0;
  const handedOff = jakartaDate(task.handed_off_at || task.completed_at || task.updated_at);
  if (!handedOff) return 0;
  return dayNumber(handedOff) - dayNumber(task.due_date.slice(0, 10));
}

export function timelinessOf(days: number, config: ScoringConfig) {
  if (days <= -1) return { multiplier: config.timeliness.early, score: 100, label: "early" as const };
  if (days <= 0) return { multiplier: config.timeliness.onTime, score: 100, label: "on time" as const };
  if (days <= 2) return { multiplier: config.timeliness.late, score: 70, label: "late" as const };
  return { multiplier: config.timeliness.veryLate, score: 40, label: "very late" as const };
}

const ratingMultiplier: Record<number, number> = { 5: 1.1, 4: 1, 3: 0.9, 2: 0.8, 1: 0.7 };

export function qualityOf(task: Pick<ScoringTask, "revision_count" | "quality_rating">, config: ScoringConfig) {
  const rating = Number(task.quality_rating);
  if (rating >= 1 && rating <= 5) return { multiplier: ratingMultiplier[Math.round(rating)], score: Math.round(rating) * 20 };
  const revisions = Math.max(0, Number(task.revision_count) || 0);
  if (revisions === 0) return { multiplier: config.quality.firstTry, score: 100 };
  return {
    multiplier: Math.max(config.quality.floor, 1 - config.quality.perRevision * revisions),
    score: Math.max(40, 100 - 15 * revisions),
  };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Weighted mean of the components that exist; missing ones (null) drop out and the rest re-weigh. */
function blend(parts: Array<[number | null, number]>) {
  const present = parts.filter(([value, weight]) => value !== null && weight > 0) as Array<[number, number]>;
  const total = present.reduce((sum, [, weight]) => sum + weight, 0);
  return total ? present.reduce((sum, [value, weight]) => sum + value * weight, 0) / total : 0;
}

// ---------------------------------------------------------------------------------------------
// Result

export type TaskCredit = {
  task_id: string;
  title: string;
  effort: number;
  share: number;
  timeliness: number;
  quality: number;
  points: number;
  lateDays: number;
  revisions: number;
  status: "done" | "overdue";
};

export type PersonScore = {
  user_id: string;
  name: string;
  track: ScoreTrack;
  department_id: string;
  /** 0–100, after manual adjustments. */
  score: number;
  components: {
    output: number | null;
    quality: number | null;
    timeliness: number | null;
    discipline: number | null;
    teamOutput: number | null;
    reviewSla: number | null;
    teamOnTime: number | null;
  };
  stats: {
    tasksDone: number;
    credited: number;
    target: number;
    onTimeRate: number | null;
    firstTryRate: number | null;
    lateTasks: number;
    overdueOpen: number;
    attendanceDays: number;
    lateClockIns: number;
    offsiteViolations: number;
    adjustment: number;
    reviewed: number;
    teamSize: number;
  };
  tasks: TaskCredit[];
  hints: string[];
};

type Accumulator = {
  credited: number;
  qualityWeighted: number;
  qualityWeight: number;
  timeWeighted: number;
  timeWeight: number;
  tasksDone: number;
  onTime: number;
  firstTry: number;
  lateTasks: number;
  overdueOpen: number;
  tasks: TaskCredit[];
};

const emptyAccumulator = (): Accumulator => ({
  credited: 0,
  qualityWeighted: 0,
  qualityWeight: 0,
  timeWeighted: 0,
  timeWeight: 0,
  tasksDone: 0,
  onTime: 0,
  firstTry: 0,
  lateTasks: 0,
  overdueOpen: 0,
  tasks: [],
});

/**
 * Score everyone for one period. Finished tasks count in the period they were completed;
 * open tasks whose due date fell inside the period and has passed count against timeliness.
 */
export function computeScores(input: {
  tasks: ScoringTask[];
  users: ScoringUser[];
  attendance: AttendanceDay[];
  ledger: LedgerEntry[];
  config: ScoringConfig;
  period: ScoringPeriod;
}): PersonScore[] {
  const { tasks, users, attendance, ledger, config, period } = input;
  const inPeriod = (date: string) => Boolean(date) && date >= period.start && date <= period.end;
  const userIds = new Set(users.map((user) => user.user_id));
  const acc = new Map<string, Accumulator>();
  const get = (id: string) => acc.get(id) ?? (acc.set(id, emptyAccumulator()), acc.get(id)!);

  const doneTasks = tasks.filter((task) => DONE_STATUSES.has(task.status) && inPeriod(taskDoneDate(task)));
  const overdueOpen = tasks.filter(
    (task) => !DONE_STATUSES.has(task.status) && task.status !== "Cancelled" && task.due_date && inPeriod(task.due_date.slice(0, 10)) && task.due_date.slice(0, 10) < period.today && !(task.handed_off_at && jakartaDate(task.handed_off_at) <= task.due_date.slice(0, 10)),
  );

  for (const task of doneTasks) {
    const effort = taskEffort(task, config);
    const late = lateDays(task);
    const time = timelinessOf(late, config);
    const quality = qualityOf(task, config);
    for (const [userId, share] of taskShares(task, config)) {
      if (!userIds.has(userId)) continue;
      const entry = get(userId);
      const weight = effort * share;
      const points = weight * time.multiplier * quality.multiplier;
      entry.credited += points;
      entry.qualityWeighted += quality.score * weight;
      entry.qualityWeight += weight;
      entry.timeWeighted += time.score * weight;
      entry.timeWeight += weight;
      entry.tasksDone += 1;
      if (late <= 0) entry.onTime += 1;
      else entry.lateTasks += 1;
      if (!(Number(task.revision_count) > 0) && !(Number(task.quality_rating) > 0 && Number(task.quality_rating) < 4)) entry.firstTry += 1;
      entry.tasks.push({
        task_id: task.task_id,
        title: task.title,
        effort,
        share: round1(share * 100) / 100,
        timeliness: time.multiplier,
        quality: quality.multiplier,
        points: round1(points),
        lateDays: late,
        revisions: Number(task.revision_count) || 0,
        status: "done",
      });
    }
  }

  for (const task of overdueOpen) {
    const effort = taskEffort(task, config);
    const late = dayNumber(period.today) - dayNumber(task.due_date.slice(0, 10));
    for (const [userId, share] of taskShares(task, config)) {
      if (!userIds.has(userId)) continue;
      const entry = get(userId);
      const weight = effort * share;
      entry.timeWeighted += timelinessOf(late, config).score * weight;
      entry.timeWeight += weight;
      entry.overdueOpen += 1;
      entry.tasks.push({ task_id: task.task_id, title: task.title, effort, share: round1(share * 100) / 100, timeliness: 0, quality: 0, points: 0, lateDays: late, revisions: Number(task.revision_count) || 0, status: "overdue" });
    }
  }

  // Discipline: punctual clock-in (60) + EOD written (40) per workday, minus Off-site violations.
  const days = new Map<string, AttendanceDay[]>();
  attendance.filter((day) => inPeriod(day.date)).forEach((day) => days.set(day.user_id, [...(days.get(day.user_id) ?? []), day]));
  const periodLedger = ledger.filter((entry) => inPeriod(jakartaDate(entry.created_at)));
  const offsiteBy = new Map<string, number>();
  const adjustmentBy = new Map<string, number>();
  for (const entry of periodLedger) {
    if (entry.source_type === "offsite_no_permit") offsiteBy.set(entry.user_id, (offsiteBy.get(entry.user_id) ?? 0) + 1);
    if (entry.source_type === "manual_adjustment") {
      adjustmentBy.set(entry.user_id, (adjustmentBy.get(entry.user_id) ?? 0) + Number(entry.points || 0));
    }
  }

  // Targets cover only the elapsed part of the period, so mid-month scores aren't half-empty.
  const elapsedEnd = period.end < period.today ? period.end : period.today;
  const periodDays = Math.max(1, daysInRange(period.start, elapsedEnd < period.start ? period.start : elapsedEnd));
  const base = users.map((user) => {
    const track = defaultTrack(user);
    const entry = acc.get(user.user_id) ?? emptyAccumulator();
    const target = round1((config.targets[track] || config.targets.general) * (periodDays / 30));
    const userDays = days.get(user.user_id) ?? [];
    const offsite = offsiteBy.get(user.user_id) ?? 0;
    const discipline = userDays.length
      ? Math.max(0, userDays.reduce((sum, day) => sum + (day.onTime ? 60 : 0) + (day.eod ? 40 : 0), 0) / userDays.length - offsite * config.offsitePenalty)
      : offsite
        ? Math.max(0, 100 - offsite * config.offsitePenalty)
        : null;
    const output = target > 0 ? Math.min(config.outputCap, (entry.credited / target) * 100) : null;
    return {
      user,
      track,
      entry,
      target,
      output,
      quality: entry.qualityWeight ? entry.qualityWeighted / entry.qualityWeight : null,
      timeliness: entry.timeWeight ? entry.timeWeighted / entry.timeWeight : null,
      discipline,
      userDays,
      offsite,
    };
  });

  const outputById = new Map(base.map((row) => [row.user.user_id, row.output]));

  return base
    .map((row) => {
      const { user, track, entry } = row;
      let teamOutput: number | null = null;
      let reviewSla: number | null = null;
      let teamOnTime: number | null = null;
      let reviewed = 0;
      let teamSize = 0;

      if (track === "leader") {
        const led = doneTasks.filter((task) => task.assigned_by === user.user_id);
        const ledOverdue = overdueOpen.filter((task) => task.assigned_by === user.user_id);
        const team = new Set(led.flatMap((task) => task.assigned_to).filter((id) => id !== user.user_id && userIds.has(id)));
        teamSize = team.size;
        const teamOutputs = [...team].map((id) => outputById.get(id)).filter((value): value is number => value !== null && value !== undefined);
        // Briefing nobody is zero team output, not "no data" — otherwise a leader with an idle
        // month would be ranked on attendance alone.
        teamOutput = teamOutputs.length ? teamOutputs.reduce((sum, value) => sum + Math.min(100, value), 0) / teamOutputs.length : 0;
        const handedOff = led.filter((task) => task.handed_off_at && task.completed_at);
        reviewed = handedOff.length;
        reviewSla = handedOff.length
          ? (handedOff.filter((task) => Date.parse(task.completed_at!) - Date.parse(task.handed_off_at!) <= config.reviewSlaHours * 3_600_000).length / handedOff.length) * 100
          : null;
        const judged = led.length + ledOverdue.length;
        teamOnTime = judged ? (led.filter((task) => lateDays(task) <= 0).length / judged) * 100 : null;
      }

      const raw =
        track === "leader"
          ? blend([
              [teamOutput, config.leaderWeights.teamOutput],
              [reviewSla, config.leaderWeights.reviewSla],
              [teamOnTime, config.leaderWeights.teamOnTime],
              [row.discipline, config.leaderWeights.discipline],
            ])
          : blend([
              [row.output === null ? null : Math.min(100, row.output), config.weights.output],
              [row.quality, config.weights.quality],
              [row.timeliness, config.weights.timeliness],
              [row.discipline, config.weights.discipline],
            ]);
      const adjustment = adjustmentBy.get(user.user_id) ?? 0;
      const score = Math.round(Math.min(100, Math.max(0, raw + adjustment)));
      const lateClockIns = row.userDays.filter((day) => !day.onTime).length;

      const hints: string[] = [];
      if (track !== "leader" && row.output !== null && row.output < 100 && row.target > 0) {
        hints.push(`${round1(Math.max(0, row.target - entry.credited))} more effort points to reach this period's target.`);
      }
      if (entry.overdueOpen) hints.push(`${entry.overdueOpen} task${entry.overdueOpen > 1 ? "s are" : " is"} past due and not handed off yet.`);
      if (entry.lateTasks) hints.push(`${entry.lateTasks} task${entry.lateTasks > 1 ? "s were" : " was"} handed off after the due date.`);
      const revised = entry.tasks.filter((task) => task.revisions > 0).length;
      if (revised) hints.push(`${revised} task${revised > 1 ? "s" : ""} needed revisions — a first-try approval earns ×${config.quality.firstTry}.`);
      if (lateClockIns) hints.push(`Late clock-in on ${lateClockIns} day${lateClockIns > 1 ? "s" : ""}.`);
      if (row.offsite) hints.push(`${row.offsite} Off-site day${row.offsite > 1 ? "s" : ""} without an approved permit.`);
      if (track === "leader" && teamSize === 0) hints.push("No briefed task was finished this period — brief work with a work type and due date to build your team score.");
      if (track === "leader" && reviewSla !== null && reviewSla < 80) hints.push(`Review hand-offs within ${config.reviewSlaHours} h — ${Math.round(reviewSla)}% made it.`);

      return {
        user_id: user.user_id,
        name: user.full_name,
        track,
        department_id: user.department_id ?? "",
        score,
        components: {
          output: row.output === null ? null : round1(row.output),
          quality: row.quality === null ? null : round1(row.quality),
          timeliness: row.timeliness === null ? null : round1(row.timeliness),
          discipline: row.discipline === null ? null : round1(row.discipline),
          teamOutput: teamOutput === null ? null : round1(teamOutput),
          reviewSla: reviewSla === null ? null : round1(reviewSla),
          teamOnTime: teamOnTime === null ? null : round1(teamOnTime),
        },
        stats: {
          tasksDone: entry.tasksDone,
          credited: round1(entry.credited),
          target: row.target,
          onTimeRate: entry.tasksDone ? round1((entry.onTime / entry.tasksDone) * 100) : null,
          firstTryRate: entry.tasksDone ? round1((entry.firstTry / entry.tasksDone) * 100) : null,
          lateTasks: entry.lateTasks,
          overdueOpen: entry.overdueOpen,
          attendanceDays: row.userDays.length,
          lateClockIns,
          offsiteViolations: row.offsite,
          adjustment,
          reviewed,
          teamSize,
        },
        tasks: entry.tasks.sort((left, right) => right.points - left.points),
        hints,
      } satisfies PersonScore;
    })
    .sort((left, right) => right.score - left.score || right.stats.credited - left.stats.credited || left.name.localeCompare(right.name));
}

/** Lifetime XP: frozen legacy points plus 10 XP per credited effort point under v2. */
export function lifetimeXp(legacyPoints: number, creditedAllTime: number) {
  return Math.round(legacyPoints + creditedAllTime * 10);
}

export type LeaderboardPeriodView = "week" | "month" | "quarter";

/** The week (Mon–Sun) / month / quarter containing `anchor`, and the anchors of the neighbours. */
export function scoringPeriod(view: LeaderboardPeriodView, anchor: string) {
  const date = new Date(`${anchor}T00:00:00Z`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const shift = (value: string, days: number) => {
    const next = new Date(`${value}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return iso(next);
  };
  if (view === "week") {
    const start = shift(anchor, -((date.getUTCDay() + 6) % 7));
    return { start, end: shift(start, 6), prev: shift(start, -7), next: shift(start, 7) };
  }
  const months = view === "quarter" ? 3 : 1;
  const firstMonth = view === "quarter" ? Math.floor(date.getUTCMonth() / 3) * 3 : date.getUTCMonth();
  const start = iso(new Date(Date.UTC(date.getUTCFullYear(), firstMonth, 1)));
  const end = iso(new Date(Date.UTC(date.getUTCFullYear(), firstMonth + months, 0)));
  return { start, end, prev: shift(start, -1), next: shift(end, 1) };
}
