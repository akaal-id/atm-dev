# Project Memory

Durable context for AI agents working on ATM. Keep entries short and dated. Update this file when you learn something non-obvious that the code or git history doesn't already say. Architecture lives in [ARCHITECTURE.md](ARCHITECTURE.md).

## Current state (2026-10-01)

- **Repos and deploy (verified 2026-10-05):**
  - Work happens in `akaal-creative/atm-dev` (this checkout's `origin`), on branch `development`.
  - Changes ship through a PR **into `akaal-id/atm-dev`, base `development`**.
  - Vercel project `atm-dev` (team "Akaal's projects", account `akaal-id`) is linked to `akaal-id/atm-dev`, with **production branch = `development`**. Merging there deploys team.akaal.id.
  - The `main` branches are not used for deploys.
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
- 2026-10-05: Desktop and Android apps (Tauri v2) are a shell that loads https://team.akaal.id. There is no static export, since the app needs its API routes, server actions, and cookies. iOS is postponed. Build, install, and distribution steps are in `docs/desktop-android-apps.md`. Windows `.exe` builds come from the GitHub Actions workflow "Desktop build".
- 2026-10-05: Real Web Push (VAPID) is live in code; see `docs/push-notifications.md`.
  - Every `Notifications` row and every chat message pushes to the user's subscribed devices (table `push_subscriptions`).
  - The VAPID keys are in `.env.local`, with a backup at `~/.config/atm/vapid.json`, and still need to be set on Vercel.
  - Android and iOS get push through the PWA install. The Tauri APK can't.
- 2026-10-05:
  - **Leaderboard tracks** were set from task data: leaders are Azzam, Asad, Afif A, and Faisal; Ridho is video; Nabil is general; everyone else is design. **Copywriters can't be told apart from designers in the task data**, so the admin must correct them in Settings → Gamification.
  - **Messages badge:** `ChatUnreadProvider` (in WorkspaceProviders) takes its count from `/api/chat/unread` and bumps it live from realtime `messages` INSERTs in the user's rooms.
  - **Mobile top bar:** 56 px tall, logo, current-page title, icon-only actions.
- 2026-10-05: Password management.
  - **Admin reset:** Employee profile → Reset password calls `POST /api/users/[id]/reset-password`. It returns a one-time temporary password and sets `must_change_password`. AppShell then redirects the user to `/account/password` until they change it.
  - **Self change:** avatar menu → Change password calls `POST /api/auth/password`.
  - **Sessions:** both bump `password_changed_at`. Session JWTs with an earlier `iat` are rejected in `getCurrentUser`, so everyone else is logged out.
  - **Not built yet:** "forgot password" by email.

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
- **Tauri build output must stay outside iCloud.** The repo is in iCloud Drive, and a single build reached 945 MB.
  - Rust: `CARGO_TARGET_DIR=~/.cache/atm-tauri-target`, set in `~/.zshrc`.
  - Gradle: `src-tauri/gen/android/{build,app/build,.gradle}` are symlinks to `~/.cache/atm-android`.
  - Gradle's Rust step runs `npm run tauri`, so `package.json` needs the `"tauri": "tauri"` script.
- **The Android release key is at `~/.android-keys/` and must be backed up.** If it's lost, updates can't be installed over existing apps.
- **iCloud can evict project files when the disk is low.** With "Optimize Mac Storage", files become `dataless`, and tsc/next then stall for minutes on 0% CPU.
  - On 2026-10-05, 22k `node_modules` files and 217 source files were evicted when free disk fell to 3.8 GB.
  - The `atm-dev` folder is now set to **Keep Downloaded**.
  - Check with `find . -flags -dataless`. The `-` matters, because the flags are `compressed,dataless`.
  - Restore with `npm ci`, or by reading the files.
- **Testing server modules with tsx:** `server-only` isn't installed, so use `.perf/tsconfig.test.json`, which maps it to a stub. Name scripts `.mts` so top-level await works.
- **Playwright `page.route` can't mock app API calls while the PWA service worker is active**, because the service worker answers first. Create the context with `serviceWorkers: "block"`.
- **Chat realtime needs the token set before subscribing.**
  - With `@supabase/ssr`'s `createBrowserClient`, a channel created right away joined *without* an access token. Supabase accepted the join ("ok") but never delivered `postgres_changes`, so messages only appeared after a refresh.
  - `src/lib/supabase/client.ts` is now a shared supabase-js client that calls `realtime.setAuth(publishableKey)` synchronously.
  - For debugging, look at the `phx_join` payload's `access_token`.
- **Chat sends must stay light.**
  - `sendMessage` inserts first. The link preview and push run in `after()`, and the preview arrives as a realtime UPDATE.
  - No `revalidatePath` on send: re-rendering the room page in the action response was the lag.
- **Test inserts into `messages` need a real `sender_id`** (it's a foreign key to users). Always check the insert response.
- **Rows inserted straight into the DB stay invisible to the app for up to 5 min.** `supabaseFetch` caches table reads under tag `sb:<table>`, and only writes through the app invalidate the tag. In tests, make one app write to that table after a direct insert.
- **No Tailwind utility classes** in migrated components. Use the co-located `*.module.css`.

## Tooling

- Code graph: `codebase-memory-mcp` (MCP) and Graphify (`graphify-out/`, regenerate with `graphify update .`).
- E2E: `npm run test:e2e` (Playwright, starts `next dev` automatically).
- RTK token-saving hook is installed globally (`rtk gain` shows savings).
- Task backlog: NgodingPakeAI CLI (see AGENTS.md).
