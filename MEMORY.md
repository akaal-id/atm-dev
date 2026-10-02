# Project Memory

Durable context for AI agents working on ATM. Keep entries short and dated. Update this file when you learn something non-obvious that the code or git history doesn't already say. Architecture lives in [ARCHITECTURE.md](ARCHITECTURE.md).

## Current state (2026-10-01)

- Branch `development` is the working branch; `main` is the PR target.
- Recent work: CSS-module migration (Tailwind utilities → plain CSS modules), folderized components, AI chat as a full-page route plus intercepted overlay, context panel switcher.
- Production database: Supabase project `aqahlffbhbyblqesgpjv`, `ATM_DATA_MODE=supabase`.
- 2026-10-01: Project Hub rework started — plan and decisions in `docs/project-hub-plan.md`. All 5 phases built 2026-10-02 (dashboard, content matrix, social dashboard, Office, personal notes); user will review in the browser and send revisions.

- 2026-10-02: Attendance rework. The office is company-wide: Skyconnection, Ragunan (-6.2908419, 106.8220527), defined as `DEFAULT_OFFICE` in `src/lib/attendance-location.ts` and overridable with Settings keys `office_lat`, `office_lng`, and `office_label`. Users cannot change it. Each user sets only their home (`/api/me/base-location`) by address search (`/api/location/search`, Nominatim), a map pin (Leaflet + OSM tiles), or GPS. Clock-in is blocked until home is set. The first clock-in is classified WFO (≤150 m, Settings `office_radius_m`), WFH (≤500 m from home), or Off-site. Off-site without an **Approved** "Off-site" request created ≥6 h before clock-in costs points (`offsite_penalty_points`, default -20), applied once at clock-out; a later approval does not undo it. Leave requests are a modal on `/attendance`, and `/attendance/request` redirects there. New pages: `/attendance/approvals` (`attendance:approve`) and `/attendance/history` (`attendance:team`, PDF report via `downloadSheetPdf`). The `users.office_*` columns exist but are unused.
- 2026-10-02: Leaderboard v2 is live. The plan and as-built notes are in `docs/leaderboard-plan.md`.
  - The score is computed from tasks and attendance on every read; there are no stored snapshots.
  - Effort comes from the task's work type, and credit is split between assignees (PIC 60%).
  - Timeliness is judged at hand-off, quality from revisions or a rating, and each person is ranked on % of their track's target.
  - Config lives in Settings `gamification_v2`.
  - The v1 auto-points are frozen as lifetime XP.
- 2026-10-02: The dashboard was rebuilt as a "Today" view in `components/app/dashboard`. It has:
  - an attendance pill and a Request leave button in the header
  - 4 personal stats (open tasks, due this week, month score, today's clock-in)
  - My tasks grouped Overdue / Today / This week / Later (max 8)
  - "Needs attention" (leave approvals and task reviews for leaders; own requests for others)
  - a "Team today" summary, announcements, and "Coming up" (calendar + birthdays, 7 days)
  - Recent activity and the duplicate announcement banners were removed.

## Gotchas

- **Env file must be `.env.local`.** On 2026-10-01 it was saved as `env.local` (no dot). Next.js ignored it, the store fell back to seed data, and real accounts got "Invalid email or password". If login fails for a valid user, check this first.
- **Silent seed fallback.** `store.ts` never errors when Supabase isn't configured; it just serves `src/lib/data/seed.ts` (demo login `nadia@akaal.test` / `atm-demo-2026`).
- **The login error is generic.** It shows the same message for "no such user", "inactive", and "wrong password".
- **This is Next.js 16.** Use `src/proxy.ts`, not `middleware.ts`, and check `node_modules/next/dist/docs/` before relying on older APIs.
- **Project hub tables are Supabase-only** (`brands`, `project_strategy_options`, `project_kpis`, …). In seed/Sheets mode the dashboard hides those panels.
- **Univer is client-only.** Load `univer-sheet` through `next/dynamic` with `ssr: false`; it owns its DOM and is created once per mount.
- **`chat-actions.ts` is a `"use server"` module** — it may only export async functions (no constants).
- **Leave requests are always filed for yourself.** `POST /api/resources/Leave_Requests` forces `user_id` to the caller and the status to Pending Approval.
- **Leaflet markers: never put `rotate`/`transform` on a divIcon element.** Leaflet positions icons with `transform: translate3d`, so a rotation on the same element rotates the position and moves the pin off the map. Rotate a `::before` instead.
- **`views.module.css` has duplicate class names from the CSS migration** (for example `.bodyTertiary` is defined twice, and the second adds `text-align: center`). When a layout centers unexpectedly, look for a later duplicate. Prefer new, specific class names over reusing the generic `body*` / `surface*` ones.
- **Pages that need header actions** (the attendance pages) render `PageHero` themselves, and `main-content.tsx` skips the layout `PageHeader` for those paths.
- **Scoring must not trust clients.** `revision_count` is only set by the server (status Waiting Approval/Ready → To Do/In Progress). Effort override, PIC, shares, and rating require `canManageTaskScoring` or being the task's `assigned_by`.
- **`updateResource` always stamps `updated_at = now`.** Scoring falls back to `updated_at` when `completed_at` is empty, so the scoring API pins `completed_at` before editing a finished task.
- **A Leader with no briefed work scores 0% team output, not "no data"**, otherwise idle leaders top the board on attendance alone.
- **iCloud duplicates in `.next/types` can be `* 2.ts` or `* 3.ts`.** Clean them with `find .next -name "* [0-9].*" -delete`.
- **No Tailwind utility classes** in migrated components. Use the co-located `*.module.css`.

## Tooling

- Code graph: `codebase-memory-mcp` (MCP) and Graphify (`graphify-out/`, regenerate with `graphify update .`).
- E2E: `npm run test:e2e` (Playwright, starts `next dev` automatically).
- RTK token-saving hook is installed globally (`rtk gain` shows savings).
- Task backlog: NgodingPakeAI CLI (see AGENTS.md).
