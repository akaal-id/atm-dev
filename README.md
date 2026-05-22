# Akaal Team Management (ATM)

ATM is a production-oriented Next.js Progressive Web App for internal team management: HR profiles, tasks, projects, attendance, leave approvals, announcements, calendar activity, notifications, and gamification.

## Stack

- Next.js App Router, TypeScript, React 19
- Tailwind CSS 4
- Server-side JWT session cookies
- Role-based access control
- Google Sheets server adapter with seeded local fallback
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

## Sheet Tabs

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
- Google Sheets credentials are loaded only from server environment variables.
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
5. Open the deployed URL, sign in, and initialize Sheets headers if using Sheets mode.

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
```
