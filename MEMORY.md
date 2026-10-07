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
  - 2026-10-05: **Desktop push needs a real browser.** The Tauri `.dmg`/`.exe` webview has no Push API. Chrome/Edge deliver while the browser process runs (on Mac, not after ⌘Q). Safari "Add to Dock" delivers even when fully closed.
  - `PushToggle mode="banner"` on the Dashboard prompts every device that isn't receiving push, with steps for its OS and browser, and hides for 7 days on "Not now". The Notifications page card has "Send test notification" (`POST /api/push/test`, this device only). On a 404 it re-registers the device and retries once.
  - **"Registration failed - push service error"** (Chromium `AbortError` from `pushManager.subscribe`) is the browser failing to reach its push service, not ATM. **Brave ships with "Use Google services for push messaging" off** (`brave://settings/privacy`). Chrome/Edge usually need a VPN/firewall turned off or a full browser restart.
  - `enablePush` retries once and throws `PushServiceError`, and `PushToggle` then shows fix steps for that browser. It is **single-flight**, because `DeviceNotifications` also calls it on load and on the first click. It replaces a subscription made with a different VAPID key.
- 2026-10-05:
  - **Leaderboard tracks** were set from task data: leaders are Azzam, Asad, Afif A, and Faisal; Ridho is video; Nabil is general; everyone else is design. **Copywriters can't be told apart from designers in the task data**, so the admin must correct them in Settings → Gamification.
  - **Messages badge:** `ChatUnreadProvider` (in WorkspaceProviders) takes its count from `/api/chat/unread` and bumps it live from realtime `messages` INSERTs in the user's rooms.
  - **Mobile top bar:** 56 px tall, logo, current-page title, icon-only actions.
- 2026-10-05: Password management.
  - **Admin reset:** Employee profile → Reset password calls `POST /api/users/[id]/reset-password`. It returns a one-time temporary password and sets `must_change_password`. AppShell then redirects the user to `/account/password` until they change it.
  - **Self change:** avatar menu → Change password calls `POST /api/auth/password`.
  - **Sessions:** both bump `password_changed_at`. Session JWTs with an earlier `iat` are rejected in `getCurrentUser`, so everyone else is logged out.
  - **Forgot password:** login → "Forgot password?" → `/forgot-password` → emailed link (Resend) → `/reset-password?token=`.
    - Tokens are stored as SHA-256 in `password_reset_tokens`. They expire after 1 h, work once, and are limited to 3 per account per hour.
    - The request endpoint answers identically for unknown emails.
    - Links use `NEXT_PUBLIC_APP_URL`, never the request Host.

- 2026-10-05: **Projects page filters** (`components/app/project-browser`):
  - Status tabs with counts, search, Owner, Member (incl. "Me"), Priority, Deadline range, and sort.
  - Filtering runs client-side over the server-rendered cards.
  - State lives in the URL (`?status=&q=&owner=&member=&priority=&from=&to=&sort=`), updated with `history.replaceState` so there's no server refetch per keystroke.
- 2026-10-05: **Data cleanup.** Only 4 test tasks were deleted (AKL-L-001, AKL-002, AKL-L-013, AKL-014), with their checklists, comments, and activity logs. All 8 projects hold real work and were kept. Their XP point rows were kept. Backup: `~/atm-backups/2026-10-05-test-tasks.json`. Later the same day, all 26 overdue To Do / In Progress tasks were set to **Cancelled** rather than deleted, at the user's choice. Their prior status is in `~/atm-backups/2026-10-05-cancelled-overdue-tasks.json`.

- 2026-10-06: **Content matrix ↔ tasks.**
  - "Import from tasks" (`POST /api/projects/[id]/content/import`) turns project tasks into content rows linked by `task_id`. Title, publication date, and month come from the task. Tasks already in the matrix are skipped.
  - Linked rows show the task's live status.
  - The existing "Create task" button goes the other way.
- 2026-10-06: **Workflow wizard step 3 assigns people per ticket** with `components/app/assignee-picker`, a reusable multi-select. "Assign all tickets to" sets every row. New and pasted rows inherit the previous row's people. Empty means the creator.

- 2026-10-06: **Add subtask takes many lines** (`components/app/subtask-quick-add`). The server (`POST /api/resources/Task_Checklists`) splits `title` by line, strips list markers, caps it at 50, creates one subtask per line, and logs each. Ctrl/⌘+Enter submits.

- 2026-10-07: **Mobile pass at 360/390 px.**
  - **Task rows:** compact on phones (status beside the ticket id, 2×2 details grid). The task filters fold behind a "Filter" button below 640 px.
  - **Long lists:** use `ShowMoreList` (Notifications, profile task history).
  - **PageHero:** slimmer on phones.
  - **Month calendar:** fits as 7 narrow columns with event dots.
  - **Email-blast history:** the table turns into cards.
  - **Project Files and Departments:** use their own classes.
  - **Top-bar dropdowns:** Organization/Company menus are pinned full-width under the bar on phones, and only one top-bar menu can be open (`src/lib/exclusive-menu.ts`). The emoji picker is pinned above the composer.
- 2026-10-07: **Project status.**
  - Edit project (dashboard) has a Status field. `PATCH /api/projects/[id]` accepts `status`, and Completed sets progress to 100.
  - Projects "All" excludes Completed.
  - Projects list paginates 6 per page (`?page=`).

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
  - A single evicted file can still break `next build`. Tailwind 4 scans every non-ignored file (including `docs/*.sql`), the read blocks, and Turbopack panics with "timeout while receiving message from process" on `globals.css`. To restore an unchanged tracked file without reading it, `git show HEAD:<path> > tmp`, then `mv` the copy over it.
- **Testing server modules with tsx:** `server-only` isn't installed, so use `.perf/tsconfig.test.json`, which maps it to a stub. Name scripts `.mts` so top-level await works.
- **Headless Chromium always reports `Notification.permission === "denied"`**, even after `grantPermissions` (`navigator.permissions.query` says "granted"). To test push UI states, override `Notification.permission` with `addInitScript`.
- **Playwright `page.route` can't mock app API calls while the PWA service worker is active**, because the service worker answers first. Create the context with `serviceWorkers: "block"`.
- **Chat realtime needs the token set before subscribing.**
  - With `@supabase/ssr`'s `createBrowserClient`, a channel created right away joined *without* an access token. Supabase accepted the join ("ok") but never delivered `postgres_changes`, so messages only appeared after a refresh.
  - `src/lib/supabase/client.ts` is now a shared supabase-js client that calls `realtime.setAuth(publishableKey)` synchronously.
  - For debugging, look at the `phx_join` payload's `access_token`.
- **Chat sends must stay light.**
  - `sendMessage` inserts first. The link preview and push run in `after()`, and the preview arrives as a realtime UPDATE.
  - No `revalidatePath` on send: re-rendering the room page in the action response was the lag.
- **Test inserts into `messages` need a real `sender_id`** (it's a foreign key to users). Always check the insert response.
- **Rows inserted straight into the DB stay invisible to the app for up to 5 min.** `supabaseFetch` caches table reads under tag `sb:<table>`, and only writes through the app invalidate the tag. In tests, make one app write to that table after a direct insert. **After a direct SQL edit on production**, purge the tag right away. Run `vercel cache dangerously-delete --tag sb:<table> --project atm-dev --scope akaals-projects --yes` (Vercel CLI ≥ 62). Otherwise pages show stale rows: the 300 s TTL is stale-while-revalidate, so the first hit after it expires still gets the old data. Verified 2026-10-05.
- **Form POST handlers must redirect with 303, not the default 307.** `NextResponse.redirect(url)` defaults to 307, which makes the browser re-POST the form body to the target *page*. Next then treats it as a Server Action request, and the page renders oddly or crashes. That broke Create task, Edit task, and the post-login dashboard. All API redirects now pass `303`, and `redirectBack` does too. Fixed 2026-10-06.
- **Never use `= []` / `= {}` as a default for a prop that ends up in `useEffect` deps.** A new array on every render re-runs the effect. If that effect calls `setState`, React aborts with error #185 "Maximum update depth exceeded" and shows "This page couldn't load". The Edit task modal (opened without `workflows`) did exactly this; use a module-level constant instead. Fixed 2026-10-06.
- **Navigation (2026-10-07):**
  - **Sidebar:** Home · Attendance · Task (Workflow, My Task, Team Task, Projects, Approvals) · Productivity (Office, Calendar, Announcements, Employees, Leaderboard, Email Blast › Compose/History/Contacts/Settings) · Messages.
  - **Phones:** the bottom bar is Home, Task, Attendance, Productivity, Messages.
  - **Hub pages:** groups open hub pages (`/tasks`, `/productivity`, built with `MenuHub` + `hubSections`). `/productivity` also lists Admin pages for admins, which is the phone route to Admin.
  - **Helpers:** active state comes from `navItemMatches`, and permission filtering from `filterNavigation` (recursive).
  - **New hub routes** must be added to `protectedRoutePrefixes` (`auth-routes.ts`) and the `proxy.ts` matcher.
  - **Back link on phones/tablets (<1024 px):** a quiet "‹ Back" (`components/app/mobile-back`) sits above page content on non-root pages. It isn't in the top bar, which the user wants untouched. It uses in-app history (tracked in MainContent, which stays mounted), else `parentHref()`. It is skipped where the page has its own back link: project dashboard, workflow detail, email-blast detail and group detail, Office file.
- **Production logs:** `vercel logs --project atm-dev --scope akaals-projects --environment production --since 7d --status-code 4xx --json`. Use the npx-cached CLI at `~/.npm/_npx/*/node_modules/.bin/vercel`, v62. `--query` matches message text, not the HTTP method.
- **Unknown columns no longer 500.** `supabase-store` writes go through `writeDroppingUnknownColumns`. On PostgREST `PGRST204` ("Could not find the 'x' column") it retries without that field and logs `[supabase-store] … is not a column of …`. Grep production logs for that line, then add the column or remove the field. Origin: Create project sent the mock `workflow_template_id`, and every project creation returned 500 (2026-10-06).
- **Regression sweep scripts (local production build, live DB):** `.perf/all-pages.mjs` covers every route, including dynamic ones. `.perf/task-flows.mjs`, `.perf/sweep.mjs`, `.perf/project-flows.mjs`, `.perf/write-flows*.mjs` cover create/edit/delete. Name test rows "ZZ …" and delete them afterwards, then purge `sb:<table>` on Vercel. Don't run flows that notify others: announcements, leave requests, email blast, clock-in. **Never create assigned data while logged in as the owner (Asad).** On 2026-10-06, test tasks "[ZZ TEST] …" defaulted to the creator as assignee and pushed "New task assigned" to his real devices; the push stays on the device after the rows are deleted. Use a dedicated test login instead: a temporary user with an org membership, removed afterwards.
- **Wide content inside a CSS grid needs `grid-template-columns: minmax(0, 1fr)`.** Otherwise the implicit column grows to the content (the Kanban board made the whole workflow page 850 px wide on phones).
- **Server-made elements rendered beside a client component's own children need a `key`**, e.g. an `action` prop placed next to a button. Otherwise React dev warns "Each child in a list should have a unique key… passed a child from ProjectsView".
- **Mobile audit scripts** (local only, `.perf/`): `mobile-audit.mjs` (overflow and clipping per route), `mobile-shots.mjs` (chunked full-page screenshots; it unrolls the shell's scroll container), `topbar-popovers.mjs`, and `exclusive-test.mjs`.
- **No Tailwind utility classes** in migrated components. Use the co-located `*.module.css`.

## Tooling

- Code graph: `codebase-memory-mcp` (MCP) and Graphify (`graphify-out/`, regenerate with `graphify update .`).
- E2E: `npm run test:e2e` (Playwright, starts `next dev` automatically).
- RTK token-saving hook is installed globally (`rtk gain` shows savings).
- Task backlog: NgodingPakeAI CLI (see AGENTS.md).
