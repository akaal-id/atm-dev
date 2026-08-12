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
