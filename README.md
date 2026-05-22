# Akaal Team Management (ATM)

ATM is a production-oriented Next.js Progressive Web App for internal team management: HR profiles, tasks, projects, attendance, leave approvals, announcements, calendar activity, notifications, and gamification.

## Stack

- Next.js App Router, TypeScript, React 19
- Tailwind CSS 4
- Server-side JWT session cookies
- Role-based access control
- Supabase or Google Sheets server adapter with seeded local fallback
- PWA manifest, service worker, install shortcuts, and offline page

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo login:

- Email: `nadia@akaal.test`
- Password: `atm-demo-2026`

## Supabase Database

Supabase is the recommended production database for ATM. It is much faster than Google Sheets or Apps Script for dashboard pages because the app can query normal database tables instead of waiting for spreadsheet scripts.

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Paste and run `docs/supabase-schema.sql`.
4. Add these variables to `.env.local`:

```bash
ATM_DATA_MODE="supabase"
SUPABASE_PROJECT_ID="your-project-ref"
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
SUPABASE_ANON_KEY="your-legacy-anon-key-if-needed"
SUPABASE_SECRET_KEY="your-server-secret-key"
SUPABASE_STORAGE_BUCKET="atm-uploads"
```

Only `SUPABASE_SECRET_KEY` can read and write the tables. Keep it in `.env.local` and Vercel environment variables only.
File uploads also use the same server-side Supabase key. ATM will create the `atm-uploads` public storage bucket automatically the first time someone uploads a profile photo or leave attachment.

### Migrating Current Sheet Or Seed Data Into Supabase

If you already have data in Google Sheets or Apps Script:

1. Keep your existing `ATM_DATA_MODE` as `apps_script`, `sheets`, or `seed`.
2. Add the Supabase environment variables above, but do not switch `ATM_DATA_MODE` yet.
3. Start the app and sign in as an admin.
4. Open `/admin/settings`.
5. Click **Migrate current data to Supabase**.
6. Change `ATM_DATA_MODE` to `supabase`.
7. Restart the dev server or redeploy Vercel.

The migration uses upsert by each table's app ID, so running it again updates existing rows instead of duplicating them.

## Google Sheets Database

ATM supports two Google Sheets connection options:

- **Apps Script web app**, recommended when you cannot use Google Cloud billing.
- **Google Cloud service account**, recommended for production teams that can manage IAM keys.

### Option A: Apps Script Without Google Cloud Billing

Use this option if Google Cloud Express Mode blocks service accounts.

1. Open your Google Sheet.
2. Click **Extensions** > **Apps Script**.
3. Delete the starter code.
4. Paste the code from `docs/apps-script-web-app.js`.
5. Change this line to your own random secret:

```js
const ATM_SECRET = "change-this-to-a-long-random-secret";
```

6. Click **Deploy** > **New deployment**.
7. Select type **Web app**.
8. Set:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
9. Click **Deploy** and authorize access to the spreadsheet.
10. Copy the **Web app URL**.
11. Add these variables to `.env.local`:

```bash
AUTH_SECRET="a-long-random-secret"
ATM_DATA_MODE="apps_script"
GOOGLE_APPS_SCRIPT_WEB_APP_URL="https://script.google.com/macros/s/..."
GOOGLE_APPS_SCRIPT_SECRET="the-same-secret-you-put-in-ATM_SECRET"
```

12. Restart the dev server.

The web app is public, but every request must include your secret. The browser never sees that secret because ATM calls Apps Script only from Next.js server code.

### Option B: Google Cloud Service Account

The app works immediately with seeded data. To use Google Sheets as the database:

1. Create a Google Cloud service account.
2. Enable the Google Sheets API.
3. Create a spreadsheet and share it with the service account email.
4. Add these variables to `.env.local` or Vercel:

```bash
AUTH_SECRET="a-long-random-secret"
ATM_DATA_MODE="sheets"
GOOGLE_SHEETS_SPREADSHEET_ID="..."
GOOGLE_SERVICE_ACCOUNT_EMAIL="service-account@project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

5. Sign in as an admin and call `POST /api/sheets/schema` to initialize sheet headers.

All Sheets access happens inside server-only route handlers and libraries. No service account keys are shipped to the frontend.

## Legacy Sheet Tabs

Create these tabs or let the schema endpoint write headers into matching tabs:

- `Users`
- `Departments`
- `Roles`
- `Tasks`
- `Task_Comments`
- `Task_Checklists`
- `Projects`
- `Attendance`
- `Leave_Requests`
- `Announcements`
- `Calendar_Events`
- `Notifications`
- `Gamification_Points`
- `Badges`
- `User_Badges`
- `Activity_Logs`
- `Settings`

The canonical field list lives in `src/lib/data/schema.ts`.

## Email Notifications With Resend

ATM can email users whenever a row is created in the `Notifications` tab. Keep the API key only in `.env.local` or Vercel environment variables:

```bash
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_EMAIL="Akaal Team Management <onboarding@resend.dev>"
RESEND_ONBOARDING_FROM_EMAIL="Akaal Team Management <onboarding@akaal.id>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

For production, replace `RESEND_FROM_EMAIL` with a verified Resend sender or domain address. If you are using Apps Script mode, redeploy `docs/apps-script-web-app.js` after pulling updates so delete operations, including department removal, are available to the app.

## Account Requests And OAuth

Public users can request access at `/signup`. New requests are stored in the `Users` tab with `signup_status=pending`, then admins can approve or reject them from `/admin`. Approved users receive a verification key by email and activate the account at `/verify`.

Optional Google and Apple signup/sign-in use NextAuth.js. Add provider credentials to `.env.local` when you are ready:

```bash
NEXTAUTH_SECRET="a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
APPLE_CLIENT_ID="..."
APPLE_CLIENT_SECRET="..."
```

Resend must verify `akaal.id` before emails can reliably send from `onboarding@akaal.id`.

## Security Model

- Auth uses an HTTP-only `atm_session` cookie signed with `AUTH_SECRET`.
- Middleware protects app routes from anonymous access.
- Route handlers enforce role permissions server-side before reading or writing resources.
- Database credentials are loaded only from server environment variables.
- Writes go through API routes so validation, audit logs, and RBAC can be centralized.

## PWA

ATM includes:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icon.svg`
- `/offline`
- Mobile bottom navigation and install shortcuts

Service worker registration is enabled in production builds to avoid stale development caches.

## Deployment On Vercel

1. Push this repository to GitHub.
2. Import it into Vercel.
3. Add the environment variables from `.env.example`.
4. Deploy.
5. Open the deployed URL and sign in. If using Supabase, run `docs/supabase-schema.sql` before the first production login.

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
```
