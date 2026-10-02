# Leaderboard v2 — audit and plan

Status: **built 2026-10-02** with the recommended answer to every open decision (section 6). See "As built" below for where it differs from the plan.

## As built

- **Code:**
  - `src/lib/scoring.ts` holds the pure engine and default config. It is unit-tested in `tests/unit/scoring.test.ts`.
  - `src/lib/server/scoring.ts` loads the data and computes the board.
  - `src/lib/server/task-scoring.ts` sanitises task scoring fields and counts revisions.
- **UI:**
  - `/leaderboard` (`components/app/leaderboard`)
  - `/admin/gamification-settings` (`components/app/gamification-settings`)
  - the task detail panel "Assignees & scoring" (`components/app/task-scoring-panel`)
  - work type, effort, and PIC fields in the task form
- **APIs:**
  - `GET/PUT /api/gamification/config`
  - `PATCH /api/gamification/tracks`
  - `PATCH /api/tasks/[id]/scoring`
  - `POST /api/leaderboard/score` (manual ± adjustment; now `settings:manage` only)
- **Storage, which differs from section 4:**
  - Work types, targets, weights, and multipliers are one JSON value in **Settings** (`gamification_v2`), not separate tables.
  - Credit split is stored on the task itself (`pic_user_id`, `contribution_shares`), not in a `task_contributions` table.
  - There is **no `score_snapshots` table**. Scores are computed on read from tasks and attendance (about 225 tasks, which is cheap). Add snapshots if it gets slow.
- **Migrations:** `docs/migrations/leaderboard-v2.sql`, plus `leaderboard-v2-backfill-work-types.sql`, which guessed a work type for 210 of the 225 existing tasks from their labels and titles.
- **v1 auto-awards are switched off** (`task_done`, `task_overdue`, `punctual_attendance`). Their ledger rows are frozen into lifetime XP. The ledger still records manual adjustments and Off-site penalties.
- **Not done:** the shadow month. v2 is live straight away, and admins still have to put people on tracks in Settings. Until then everyone except Leaders and Managers is on "General".

## 1. Audit: how scoring works today

Source: `src/lib/server/gamification.ts`, `LeaderboardView` in `src/components/app/views/views.tsx`, and production data on 2026-10-02.

| Rule | Points | Notes |
|---|---|---|
| Task finished | +50 | Every assignee gets the full 50. Task size, type, and role make no difference. |
| Task overdue | −20 | Applied once, as soon as the due date passes. It stays even when the task is finished later. |
| Attendance "Present" | +10 | Only the legacy `attendance` table. The new time-tracking sessions earn nothing. |
| Off-site without a permit | −20 | Added 2026-10-02. |

### What the data shows

- **The score counts how often you were tagged, not how much you did.** There are 225 tasks, but 1,339 "task done" awards. Tasks average 6.2 assignees; 59 tasks have 9 assignees and 24 have 10. A task assigned to the whole team pays 50 points to each of the 9 people. The person who did the work and the people who were only cc'd get the same.
- **The overdue penalty fires on almost every task.** There are 1,163 overdue penalties against 1,339 completions, and 1,098 of the penalized tasks are now finished. 44 were handed off on or before the due date and were penalized anyway. Most penalties came in bulk sync runs (415 on 2026-07-20). The penalty also lands on the worker when the delay was a leader's approval.
- **Weight is identical for every kind of work.** A KV poster, an offering deck, a caption, and a 5-minute fix all pay 50. There is no task-type or effort field. Priority can't stand in for one either: 170 of 225 tasks are "Medium".
- **Leaders and managers are invisible.** One person assigned 186 of the 225 tasks, and their briefing and reviewing earn nothing. They still appear in the same list as the people they direct, scored as if they were an individual contributor. The HR manager has 90 points.
- **Roles can't be told apart.** Every active user has the position "Team Member". The system can't tell a designer from a copywriter.
- **There is no time window.** Scores are all-time. The Weekly, Monthly, All-time, and Department tabs and the Filter button are decorative and do nothing. Newcomers can never catch up.
- **Attendance is uneven.** Only the legacy log is scored, so whole departments that use the new terminal show 0 attendance points.
- **The page itself:**
  - The headline metrics are event counts ("Point events", "Task done"), which mean nothing to an employee.
  - The admin "Manage scores" forms sit in the middle of the public page.
  - Nobody can see *why* they have their score or how to improve it.
  - The podium order uses leftover Tailwind classes (`md:order-*`).

## 2. Principles for the new score

1. **Weigh the work, not the person.** Every task carries **effort points** that come from its *work type*, such as Carousel design 3, Caption 1, KV poster 5, Offering deck 8, or Motion reel 5. That is what makes a copywriter's task and a designer's task fair to each other.
2. **Split credit among contributors, never duplicate it.** A task's points are shared between its assignees. The default is the PIC 60% and the rest shared equally. A leader can adjust the split. Being cc'd earns nothing.
3. **Judge timeliness when the work is handed off, and as a multiplier.** It is not a one-shot fine.
   - Handed off on time ×1.0, at least a day early ×1.1, 1–2 days late ×0.8, more than 2 days late ×0.6.
   - Time spent in *Waiting Approval* doesn't count against the worker.
   - A due-date change by a leader resets the clock.
4. **Reward quality.**
   - Approved on the first try ×1.1, and each revision round −10% (floor ×0.7).
   - An optional 1–5 rating from the reviewer feeds the quality component.
5. **Compare each person against their own track's target.** People are grouped into **tracks**: Design, Copywriting, Video/Motion, Account/Social, Leader/Manager. Each track has a monthly target of effort points. Rank on **% of target**, so tracks can be compared.
6. **Give leaders their own measures.**
   - Approvals reviewed within 24 h.
   - The team's on-time rate.
   - Tasks briefed with a work type and due date.
   - The team's average score.

   Leaders are ranked on their own board.
7. **Keep discipline separate and small.** Attendance covers on-time clock-in, EOD submitted, and Off-site compliance. It is capped at 10% of the score and computed from the new attendance sessions.
8. **Use monthly seasons.** The ranking resets every month. A separate lifetime XP and level shows long-term contribution without locking the ranking.

### Score formula (per person, per month)

```
Output      = Σ (effort × share × timeliness × quality)  ÷ track monthly target   → capped at 120%
Performance = 50% Output + 20% Quality + 20% Timeliness + 10% Discipline           → 0–100
Leaders:      40% team output + 25% review SLA + 20% team on-time + 15% discipline
```

All weights and multipliers live in Settings (`gamification_rules`), so they can be tuned without a deploy.

## 3. Page design

1. **My scorecard**, at the top, for everyone:
   - rank, score out of 100, and change versus last month
   - the four components as bars
   - progress towards the track target
   - one "how to improve" hint, for example "3 tasks were 1–2 days late"
2. **Filters that work:** period (This week, This month, Last month, Quarter), board (Overall, by track, Leaders), and department.
3. **Podium** with the top 3 for the selected board and period.
4. **Ranking table:**
   - columns: rank and movement ▲▼, person, track, score, output %, on-time %, first-try approval %, attendance
   - clicking a row opens a breakdown: which tasks, their points, and the multipliers applied
5. **"How scoring works"** panel, so the rules are transparent.
6. **Admin tools move to Settings → Gamification:**
   - the work-type catalogue and effort points
   - track targets and multipliers
   - manual adjustment, with a required reason and an audit log

## 4. Data model changes (additive)

| Change | Purpose |
|---|---|
| `work_types` (id, company_id, name, track, default_effort, active) | Effort catalogue, managed in Settings |
| `tasks.work_type_id`, `tasks.effort_points`, `tasks.revision_count`, `tasks.quality_rating` | Weight and quality per task. Effort defaults from the work type, and a leader can override it. |
| `task_contributions` (task_id, user_id, role, share) | Credit split. `assigned_to` stays for visibility. |
| `users.score_track` | Design / Copywriting / Video / Account / Leader |
| `score_targets` (company_id, track, monthly_effort) | Normalization |
| `score_snapshots` (user_id, period, components jsonb, score, rank) | Computed in the background, so the page reads one small table instead of recomputing |

`gamification_points` stays as the event ledger, with a new `category` column (output, quality, timeliness, discipline, leadership, adjustment).

## 5. Rollout

| Phase | Scope | Size |
|---|---|---|
| 0. Quick fixes | Make the period tabs work (default: this month), remove the fake Filter, fix the podium order, and stop the overdue penalty for tasks handed off on time. Score attendance from the new sessions. | S |
| 1. Work types and effort | `work_types` with a Settings UI, plus a work-type and effort picker in the task create/edit form (pre-filled from the type). Back-fill existing tasks from their labels where possible, otherwise default effort 2. | M |
| 2. Contributions | PIC and share in the task form, defaulting to the PIC 60% and the rest shared equally. Track revision rounds when a task moves from Waiting Approval back to In Progress. | M |
| 3. Scoring engine v2 | Multipliers, track normalization, leader metrics, and monthly `score_snapshots`, refreshed with `after()` and recomputed on demand. | M |
| 4. Page redesign | Scorecard, filters, podium, ranking with breakdown, a "How scoring works" panel, and admin tools moved to Settings. | M |
| 5. Shadow month | The new score runs next to the old one, visible to admins only, to calibrate targets. Then switch over. The old points are frozen as lifetime XP. | — |

## 6. Decisions needed

1. **Tracks.** Which tracks exist, and who is in each? Suggested: Design, Copywriting, Video/Motion, Account/Social, Leader/Manager.
2. **Ranking.** One overall board on normalized %, with per-track filters (recommended), or only separate boards per track?
3. **Effort.** Set automatically from the work type and adjustable by a leader (recommended), or always set manually?
4. **Season.** Monthly reset (recommended), or quarterly?
5. **Old points.** Freeze them as lifetime XP and start fresh (recommended), or recompute history with the new rules using default weights?
6. **Stakes.** Will the score be tied to bonuses or appraisals? If so, it needs the shadow month and a dispute/correction flow before going live.
