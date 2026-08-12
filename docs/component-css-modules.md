# Component folders & CSS modules

This doc records the **folder management + CSS modules** convention adopted for ATM ERP (full pass, Aug 2026): how UI is organized, how styles are written, and what changed in the migration.

## Why both `src/app` and `src/components/app`?

These are **not** duplicates.

| Path | Role |
|------|------|
| `src/app` | Next.js **App Router** — URL routes (`page.tsx`, `layout.tsx`), API handlers (`route.ts`) |
| `src/components/app` | **ATM product UI** — shell, views, forms mounted by those routes |
| `src/components/ui` | Shared UI primitives (button, modal, …) |
| `src/components/hub` | Landing hub UI |

**Thin page pattern** (keep this):

```tsx
// src/app/(workspace)/admin/approval/page.tsx
import styles from "./approval.module.css";
import { ApprovalView } from "@/components/app/approval-view";

export default async function AdminApprovalPage() {
  // auth + data fetching here
  return (
    <div className={styles.page}>
      <ApprovalView data={data} />
    </div>
  );
}
```

Route folders own URLs. Feature UI lives under `components/` so it can be shared and keep `"use client"` off the route file when needed.

---

## Component folder shape

Every component lives in its **own folder** with a co-located CSS module and a stable barrel:

```
src/components/app/app-shell/
  app-shell.tsx
  app-shell.module.css
  index.ts          # export { AppShell } from "./app-shell"
```

Same for `components/ui/…`, feature trees (`email-blast/…`, `workflow/…`, `chat/…`), and `hub/…`.

### Imports

Public paths stay short via `index.ts`:

```ts
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
```

Prefer that over deep paths like `@/components/app/app-shell/app-shell`.

Inside the component folder, CSS is relative:

```ts
import styles from "./app-shell.module.css";
```

### `"use client"`

If the file is a Client Component, `"use client"` must be the **first** statement (before any imports).

```tsx
"use client";

import styles from "./thing.module.css";
import { useState } from "react";
```

---

## Route CSS modules

Each route segment with a `page.tsx` has a sibling **`<segment>.module.css`** (not `page.module.css`):

```
src/app/(workspace)/admin/approval/
  page.tsx
  approval.module.css
```

```tsx
import styles from "./approval.module.css";
```

- Thin data-loader pages still get a real module (at least a `.page` wrapper).
- View-heavy styling lives on the matching `components/app/*` module.
- Redirect-only pages may `void styles.page` so the import stays valid without JSX.

Examples of segment names: `approval.module.css`, `dashboard.module.css`, `home.module.css` (root `src/app/page.tsx`), `roomId.module.css` (dynamic `[roomId]`).

---

## CSS module rules

### Required

- **Plain CSS only** in `.module.css`: `display`, `gap`, `padding`, `color: var(--…)`, `@media`, etc.
- Prefer theme tokens from [`src/app/globals.css`](../src/app/globals.css): `var(--border)`, `var(--foreground)`, `var(--primary)`, …
- Responsive layout via `@media`, not Tailwind `sm:` / `md:` class prefixes.
- Compose in TSX with `styles.foo` / `cn(styles.a, styles.b)`.

### Forbidden

- `@apply` in component/route modules
- Tailwind utility lists inside `.module.css`
- Empty “scaffold” modules with no real rules
- Leaving layout/visual Tailwind utilities in `className` after a file is migrated (`"flex gap-4 …"`)

`globals.css` may still import Tailwind/theme for **base tokens**. Migrated components and pages must not depend on utility classes for their UI.

### Class naming (semantic)

Name classes by **UI role**, not CSS shape.

| Avoid | Prefer |
|-------|--------|
| `.flex`, `.flex2` | `.toolbar`, `.row`, `.item` |
| `.textsm`, `.textbase` | `.title`, `.empty`, `.caption` |
| `.rounded2px`, `.minw0` | `.taskCard`, `.itemBody` |
| `.spacey4` | `.stack`, `.body` |

Good examples:

- Activity feed: `title`, `empty`, `body`, `item`, `marker`, `itemDescription`, `itemMeta`, `showMore`
- Approval: `toolbar`, `statusTab`, `statusTabActive`, `taskCard`, `checklistItem`, `emptyState`
- Chat layout: `shell`, `sidebar`, `roomList`, `roomLink`, `searchBar`, `mainPane`

Variants: `statusTab` + `statusTabActive` / `statusTabIdle`, not `button2` / `button3`.

---

## UI primitives (`components/ui`)

Primitives (especially `button`) use CSS modules for variants instead of `cva` + Tailwind strings:

```ts
// buttonVariants({ variant, size }) → styles.root + styles.default + styles.sizeLg
import { Button, buttonVariants } from "@/components/ui/button";
```

`index.ts` keeps the public API stable for callers (including `Link` + `buttonVariants(...)`).

---

## What the migration did

1. **Documented** short rules in [`AGENTS.md`](../AGENTS.md) (agent-facing).
2. **Folderized** flat `component.tsx` + `component.module.css` pairs under `components/app`, `components/ui`, and feature folders; added `index.ts` re-exports.
3. **Migrated** Tailwind utility `className`s into plain CSS modules (no `@apply`).
4. **Renamed** auto-generated class names (`flex`, `textsm`, …) to semantic names.
5. **Added** `<segment>.module.css` for every `page.tsx` and wired imports/wrappers.
6. **Re-homed** shared sheets (e.g. hub styles → `components/hub/hub-page/`, form/route CSS ownership clarified).
7. **Fixed** build issues from the pass: `"use client"` order, unused `styles` imports, orphan empty CSS files.

Helpers used during the pass live under `scripts/` (e.g. `migrate-css-modules.mjs`, `rename-css-classes*.mjs`, `fix-use-client-order.mjs`). Prefer following this doc for new work rather than re-running bulk migrators blindly.

---

## Checklist for new UI

1. Create `name/name.tsx` + `name/name.module.css` + `name/index.ts`.
2. Put `"use client"` first if needed.
3. Style with semantic CSS module classes + theme tokens; no `@apply`, no utility `className` soup.
4. Export from `index.ts`; import as `@/components/.../name`.
5. If adding a route: add `<segment>.module.css` next to `page.tsx` and apply `styles.page` (or real page-level classes) on the outermost element.
6. Keep `page.tsx` thin — data/auth in the route, UI in `components/app`.

---

## Quick reference

```
src/app/(workspace)/feature/page.tsx     → routing + data
src/app/(workspace)/feature/feature.module.css
src/components/app/feature-view/
  feature-view.tsx
  feature-view.module.css
  index.ts
```

Import UI: `@/components/app/feature-view`  
Import page CSS: `./feature.module.css`

---

## Audit findings (post-migration review, Aug 2026)

A follow-up audit of the migration commit (`9db45d5`) checked the whole tree for
compliance and for elements that render unstyled. Summary: **folder shape, route
modules, barrels, and the "no `@apply`" rule are clean. The migration's one serious
regression is that global component classes were folded into modules by name and lost
their base styling.** Details below, most severe first.

### Status (remediation in progress)

- **Email-blast `.input` regression:** fixed — group picker uses `FormSelect`; other
  blast fields use literal global `className="input"` plus incremental module classes
  (`searchField`, `bodyField`, `emailField`). Account-settings mojibake (`â€”` → `—`) fixed.
- **Remaining:** same `.input` pattern outside email-blast (modals, views, chat dialogs,
  etc.) and residual utility `className`s in §2.

### 🔴 1. Global `.input` component class was severed by CSS-module hashing (systemic)

**This is the cause of the unstyled form controls (e.g. the "Pilih grup kontak"
select in email-blast).**

`globals.css` defines a real component class — `.input` — that carries the border,
background, radius, and padding for every text input / select / textarea:

```css
/* src/app/globals.css */
.input { width:100%; border-radius:var(--radius); border:1px solid var(--input);
         background:var(--card); padding:0.625rem 0.75rem; font-size:0.875rem; … }
.input.pl-9 { padding-left:2.25rem; }   /* icon-prefixed inputs */
```

Pre-migration, markup used it as a **global** class alongside utilities:

```tsx
<input className="input h-10 text-sm font-normal" />   // "input" = global component class
```

The migrator treated `input` as if it were just another utility token and folded only
the *incremental* utilities into a module class, producing e.g.:

```css
/* email-blast-add-contact-form.module.css */
.input { height: 2.5rem; font-size: 0.875rem; font-weight: 400; }  /* no border/bg/padding! */
```

Because a CSS module hashes `.input` to something like `input__a1b2c3`, `styles.input`
**no longer matches the global `.input`** — so the base border/background/padding is
gone and the control renders as a raw browser input/select.

- **Scope:** 17 components reference `styles.input`; **16 of them have a module `.input`
  with no `border`** (i.e. broken). The one exception is `chat-input` where `.input`
  legitimately means `display:none` (a hidden file input).
- **Affected files** (`.input` orphaned from the global base):
  `email-blast/email-blast-group-picker`, `email-blast/email-blast-add-contact-form`,
  `email-blast/email-blast-contacts-view`, `email-blast/email-blast-recipients-field`,
  `email-blast/email-blast-group-detail-view`, `email-blast/email-blast-compose-view`,
  `create-task-modal`, `create-project-modal`, `announcement-create-form`,
  `attendance-terminal`, `project-file-form`, `workflow-checklist-item`,
  `chat/members-dialog`, `chat/task-picker-dialog`, `views` (dashboard.module.css),
  and (partially) `email-blast-account-settings-view`.
- **Icon-inset variant:** in `email-blast-group-picker.module.css` and
  `email-blast-contacts-view.module.css`, `.input { padding-left: 2.25rem }` was meant
  to layer on top of the global `.input` (the old `.input.pl-9` rule). With the base
  gone, you get a borderless select with an icon overlapping the text — exactly the
  "Pilih grup…" screenshot.

**Fix options (pick one, apply consistently):**
1. **Preferred:** stop hand-rolling raw `<input>`/`<select>`. Route these through the
   existing UI primitives — `components/ui/input`, `components/ui/form-select`,
   `components/ui/filter-select` — which own the styling. The group-picker's raw
   `<select>` should become `<FormSelect>`.
2. Or: give each broken module `.input` the full base declaration (composing
   `border/background/radius/padding` from tokens), instead of only the incremental
   props. Note this duplicates `globals.css .input` across 16 files — a maintenance
   smell; option 1 is better.
3. Do **not** "fix" this by referencing the global class via `:global(.input)` in each
   module — that reintroduces the global coupling the migration was trying to remove.

> **Rule going forward:** the migrator must never fold a **global component class**
> (`.input`, and any future `.btn`/`.card`-style globals) into a module class by name.
> Global component classes stay as literal string classNames, OR the element is
> converted to the corresponding `components/ui/*` primitive. Utilities-only classNames
> are the only thing safe to fold into a module. The `ws-*` helpers
> (`ws-toolbar`, `ws-row`, `ws-empty`, `ws-eyebrow`, `ws-section-title`) were handled
> correctly this way — they remain literal `className="ws-…"` strings and still resolve.

### 🟠 2. Residual Tailwind utility soup in un/partly-migrated TSX (convention, not visual)

These still render fine (Tailwind is still active for base tokens), but they violate the
"no utility `className` after migration" rule and should be finished:

| File | ~count | Notes |
|------|--------|-------|
| `email-blast/email-blast-account-settings-view` | 12 | largest offender; also has a broken `.input` |
| `task-workspace` | 7 | e.g. `className="flex min-w-0 items-start justify-between gap-2"` (task-workspace.tsx:505) |
| `workflow/workflow-create-form` | 6 | |
| `app/(workspace)/chat/page.tsx` | 4 | route file still holds layout utilities |
| `workflow/workflow-template-detail` | 2 | |
| `views` | 2 | mostly `ws-*` (fine) + a couple stray utilities |
| `company-switcher` | 2 | |
| `workflow/workflow-template-create-form`, `chat/members-dialog`, `app/(workspace)/admin/settings/page.tsx` | 1 each | |

> **Sharper form of the inconsistency (confirmed by a second pass):** plain `<input>`
> elements often *kept* the fully-styled **global** `className="input"`, while the
> `<textarea>`/`<select>` next to them got the stripped **module** `styles.input`. So a
> single form can show a properly-bordered text field directly above a borderless
> textarea/select. Whichever fix you pick, apply it per-form so all fields match.

### 🟡 2b. Minor structural notes (low priority)

- `src/components/app/views/` contains a second module, `dashboard.module.css`, beside
  `views.tsx` + `views.module.css` (imported as `dashStyles`). It works, but it's the one
  folder with two CSS modules where only `views.module.css` matches the component name —
  consider splitting the dashboard view into its own folder.
- `email-blast-account-settings-view.tsx:70` contains a mojibake em-dash (`â€”`) — an
  encoding artifact, unrelated to CSS but visible in the UI; worth fixing while migrating
  that file.

### 🟢 3. Categories that came back CLEAN (checked, no action needed)

- **`@apply` in modules:** none. (A grep for `@apply` matches 95 files, but every hit is
  the `/* … no @apply */` comment header the migrator wrote — no real directives.)
- **Folder shape:** no bare `*.tsx` sitting un-folderized in `components/app|ui|hub`;
  every component folder has an `index.ts` barrel.
- **Route modules:** every `page.tsx` has a sibling `<segment>.module.css`; no leftover
  `page.module.css`; no missing modules.
- **Empty scaffold modules:** the ~40 route modules that look "empty" all contain a real
  `.page { min-width:0; width:100%; max-width:100% }` rule — minimal but valid per the
  thin-page convention, not forbidden empties.
- **Undefined `styles.X` references:** none. Every `styles.foo` used in TSX resolves to a
  class defined in a co-located (or intentionally shared) module. `content-area`,
  `main-content`, and `organization-switcher` correctly import a shared sibling module
  (`app-shell` / `company-switcher`) — by design, not an error.

### Suggested remediation order

1. ~~Fix the `.input` regression in email-blast~~ (done — `FormSelect` + global `input`).
2. Fix the remaining `.input` regressions outside email-blast the same way
   (prefer `ui/*` primitives for selects; literal `"input"` + incremental module
   classes for text/textarea until they move to `ui/input`).
3. Finish migrating the ~10 residual-utility files in §2.
4. Add a lint/CI check: fail if a `.module.css` defines `.input` without a `border`
   (cheap guard against this exact regression), and if a migrated TSX still contains
   utility-token `className` strings.
