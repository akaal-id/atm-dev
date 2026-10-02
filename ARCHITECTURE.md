# ATM Architecture

Akaal Team Management (ATM): a multi-tenant Next.js PWA for internal team ops — HR profiles, tasks, projects, workflows, attendance, leave approvals, announcements, calendar, chat, email blast, notifications, gamification, and an AI assistant.

## Stack

- **Next.js 16.2 App Router** (breaking changes vs. older Next — read `node_modules/next/dist/docs/` first), React 19, TypeScript
- **Styling:** plain CSS modules per component/route; Tailwind 4 only for base tokens in `src/app/globals.css` (see `docs/component-css-modules.md`)
- **Auth:** custom JWT session cookie `atm_session` (`jose` + `bcryptjs`) plus `next-auth` for Google/Apple OAuth
- **Data:** pluggable store — Supabase (production), Google Sheets, Apps Script, or in-memory seed
- **AI:** Vercel AI SDK (`ai`, `@ai-sdk/google`) with a module/tool registry
- **E2E tests:** Playwright (`tests/e2e/`)

## Directory map

| Path | Role |
|---|---|
| `src/proxy.ts` | Request proxy (Next 16 replacement for middleware): auth gate + tenant URL → cookie rewrite |
| `src/app/` | Routes only — `page.tsx`, `layout.tsx`, `route.ts`; keep pages thin |
| `src/app/(workspace)/` | Authenticated app: dashboard, tasks, projects, workflows, attendance, calendar, chat, ai-chat, email-blast, employees, leaderboard, notifications, project-files, admin |
| `src/app/(workspace)/@modal/` | Parallel/intercepting route slot (e.g. AI chat overlay) |
| `src/app/api/` | Route handlers (auth, resources, tasks, ai, email-blast, billing, admin, …) |
| `src/app/{login,signup,verify,invite,billing,offline}` | Public / pre-auth pages |
| `src/components/app/` | Product UI (shell, views, forms), one folder per component |
| `src/components/ui/` | Shared primitives (button, modal, select, tabs, toast, …) |
| `src/components/hub/` | Landing hub |
| `src/lib/server/` | Server-only logic: `auth.ts`, `store.ts`, `supabase-store.ts`, `company-context.ts`, domain actions |
| `src/lib/server/ai/` | AI assistant: `registry.ts`, `system-prompt.ts`, `modules/*` (task, subtask, workflow, memory) |
| `src/lib/` | Shared client/server helpers: `permissions.ts` (RBAC), `tenant-path.ts`, `navigation.ts`, `types/` |
| `src/components/app/project-dashboard/`, `src/components/app/office/` | Project hub and Office UI |
| `src/lib/data/seed.ts` | Seed data used when no external store is configured |
| `docs/` | SQL schema + migrations, Apps Script source, feature docs |
| `scripts/` | One-off codemods (CSS-module migration, workflow seeding) |

## Key flows

**Multi-tenancy.** Canonical workspace URLs are `/org/{orgId}/c/{companyId}/<path>` (`src/lib/tenant-path.ts`). `proxy.ts` sets the active org/company cookies from the URL and rewrites to the legacy path (`/dashboard`, `/tasks`, …) under `(workspace)`. Server code resolves the tenant via `getActiveCompanyContext()`.

**Auth.** `POST /api/auth/login` → `authenticateUser()` looks up `Users` by email, requires `is_active`, and checks the bcrypt hash in `password_hash_or_auth_id` (OAuth accounts store `oauth:<provider>` there). On success it sets `atm_session` plus the tenant cookies. Sign-ups are created inactive/pending until an admin approves or `/verify` is used.

**Data store.** `src/lib/server/store.ts` picks the backend from `ATM_DATA_MODE` (`supabase` | `sheets` | `apps_script`) **only if** that backend's env vars are present; otherwise it silently falls back to in-memory seed data. Resources are named in PascalCase (`Users`, `Tasks`, …) and mapped to snake_case Supabase tables in `supabase-store.ts`.

**RBAC.** Roles (`super_admin`, admin, …, `employee`) map to permissions in `src/lib/permissions.ts`; guard pages with `requireUser()` / `requirePermission()` from `src/lib/server/auth.ts`.

**Project hub.** `/projects/[projectId]` is the project dashboard (Overview · Social Media · Content Matrix · Files & SOP), backed by Supabase-only tables (`brands`, `project_strategy_options`, `project_kpis`, `content_items`, `audience_personas`, `campaigns`) through `src/lib/server/project-hub.ts`. Edit rights: `projects:manage`, project owner, or PIC; project members may edit the content matrix. Plan and decisions: `docs/project-hub-plan.md`.

**Office.** `/office` holds Univer spreadsheets and rich-text docs in `office_files`; each file belongs to a project unless it is the owner's personal note (enforced by a DB check). Personal notes can also be written in the user's private chat room (`chat_rooms.type = 'self'`) and exported to DOCX / PDF or saved to Office.

**Leaderboard.** `/leaderboard` ranks people monthly on a 0–100 score computed by `src/lib/scoring.ts`, using effort-weighted task credit split between assignees, timeliness at hand-off, quality, and discipline, normalised per track. Leaders are scored on their team. Config is in Settings `gamification_v2`, edited at `/admin/gamification-settings`. Plan: `docs/leaderboard-plan.md`.

**AI assistant.** `/api/ai/chat` streams responses; tools come from `src/lib/server/ai/registry.ts`. Mutations follow a preview → `[ATM_CONFIRM]` → apply contract (`src/lib/ai/mutation.ts`). Status doc: `docs/ai-assistant-status.md`.

## Environment

Env vars live in `.env.local` (gitignored; Next.js only loads it with the leading dot). Supabase project ref: `aqahlffbhbyblqesgpjv` ("ATM's Project", ap-northeast-2).
