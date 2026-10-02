# Project Hub — Plan & Decisions

Living doc for the project-centric rework of ATM (project dashboard, content matrix, social media dashboard, Office, personal notes). Update the status table as phases land.

## Goal

Make ATM follow Akaal's agency flow:

**Project → strategy (funnel / pillar / channel / KPI) → content matrix → production task → publication → documents.**

Every output (content, caption, links, office files) belongs to a project. The only exception is a user's personal notes.

## Decisions (2026-10-01)

| # | Question | Decision |
|---|---|---|
| 1 | Akaal task flow | **Brief → Produksi → Review/Approval → Terjadwal → Published**, mapped to workflow columns |
| 2 | Content row vs task | A content row **may** link to a task (`task_id`). Rows can exist as ideas first; "Create task" generates the task when production starts |
| 3 | KPI actuals | Manual input, plus counts computed from the content matrix. Platform APIs (Meta/TikTok) are a later phase |
| 4 | Funnel stages | Default **Awareness (TOFU) · Consideration (MOFU) · Conversion (BOFU)**, editable per project |
| 5 | Brands | Company-level brand master with sub-brands (`parent_brand_id`); a project picks its brands via `project_brands` |
| 6 | Office | **Sheets first** (`@univerjs/preset-sheets-core`); docs preset later. Export `.xlsx` via SheetJS (Univer's native exchange and collaboration are paid Pro features) |

Default pillars: Educational, Entertaining, Inspirational, Promotional. Default channels: Instagram, TikTok, YouTube, Facebook, LinkedIn, X, Website. All are editable per project.

## Data model

New tables are Supabase-only, accessed server-side with the secret key (RLS on, no policies — same as existing tables), and carry `company_id`.

| Table | Phase | Purpose |
|---|---|---|
| `projects` (+ `project_type`, `period_start`, `period_end`, `objective`, `pic_user_id`, `sop_content`) | 1 | Project header |
| `project_files` (+ `category`: `general` / `base` / `sop`) | 1 | Base files and SOP attachments |
| `brands`, `project_brands` | 1 | Brand master and per-project selection |
| `project_strategy_options` (`type`: funnel / pillar / channel / theme) | 1 | Dropdown sources and pillar `target_share` |
| `project_kpis` | 1 | KPI target vs actual |
| `content_items` | 2 | Content matrix rows, caption, links |
| `audience_personas`, `campaigns` | 3 | Social media dashboard |
| `office_files` (`CHECK (scope = 'personal' OR project_id IS NOT NULL)`) | 4 | Univer workbooks |
| `chat_rooms.type = 'self'` | 5 | Personal notes room |

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Data foundation, `/projects/[projectId]` with Overview (period, objective, PIC, team, KPIs, strategy) and Files & SOP tabs; brand + strategy management | Built 2026-10-01 |
| 2 | Content matrix (columns per brief), caption/links modal with one-click copy, create-task-from-row, Excel export | Built 2026-10-02 |
| 3 | Social media dashboard: personas, funnel pyramid, pillar % bars, campaigns (upcoming/running/done) | Built 2026-10-02 |
| 4 | Office menu with Univer Sheets + Univer Docs; import .docx / .xlsx / .xls / .csv / .ods; (tabs, page setup, fonts, tables, images, links, header/footer); folders per project + personal; autosave; sheets → XLSX / PDF, docs → DOCX / PDF | Built 2026-10-02 |
| 5 | Personal notes chat room; multi-select messages → DOCX/PDF download or save to Office | Built 2026-10-02 |

Migrations live in `docs/migrations/project-hub-*.sql`.

All phases built; awaiting in-browser review by the user (2026-10-02). Migrations `project-hub-phase1..5.sql` are applied to Supabase `aqahlffbhbyblqesgpjv`.

## Code map

- Route: `src/app/(workspace)/projects/[projectId]/page.tsx`
- UI: `src/components/app/project-dashboard/*` (dashboard shell, overview, KPI panel, strategy panel, files panel, SOP editor, settings modal)
- Data: `src/lib/server/project-hub.ts` (Supabase-only; `getProjectAccess` = company-scoped project + edit rights for `projects:manage`, owner, or PIC)
- API: `src/app/api/projects/[projectId]/{route,brands,strategy,kpis}`
- Header fields (type, period, objective, PIC) also go through the generic `/api/resources/Projects` create form
- Content matrix: tab `?tab=content` → `project-content-matrix`, `content-item-modal`, `content-caption-modal`; API `/api/projects/[id]/content`; helpers `src/lib/content-matrix.ts`
- Social media: tab `?tab=social` (only `project_type = social_media`) → `project-social-dashboard`; API `/personas`, `/campaigns`; helpers `src/lib/social-hub.ts`
- Office: `/office` (browser, `?location=personal|<projectId>`) and `/office/[fileId]` (editor); `src/components/app/office/*`; API `/api/office`; access rules in `src/lib/server/office.ts`. Sheets use Univer Sheets (`univer-sheet`); docs use Univer Docs (`univer-doc`) inside `office-doc-editor`, which adds document tabs, a Pages / Pageless switch (Univer `documentFlavor` TRADITIONAL / MODERN), and page setup. Pageless tabs keep their paper settings in `tab.setup` for DOCX/PDF export. Doc snapshot = `{ version: 2, tabs: [{ id, title, data: IDocumentData }] }`; HTML in `content` is imported on first open (notes saved from chat)
- Import (`src/lib/office-import/*`, Office → Import): converted in the browser, then `POST /api/office` with `snapshot`.
  - DOCX: mammoth → HTML → Univer's own `convertClipboardHtmlToDocumentData` (the paste engine). We rewrite `<em>/<strong>` as inline CSS (Univer maps `<em>` to bold), size images, and register them in `resources["DOC_DRAWING_PLUGIN"]` — the render layer loads images from that resource, not from `drawings`
  - XLSX: exceljs (values, formulas, fonts, fills, borders, alignment, number formats, merges, sizes, freeze). XLS / CSV / ODS: SheetJS (values, formulas, merges, widths)
- Sheet PDF: `src/lib/sheet-pdf-export.ts` — used range → HTML table (values formatted with Univer's `numfmt`, style ids resolved, merges, hidden rows/cols skipped, widths/heights) → html2canvas → jsPDF, cut at row boundaries; landscape + shrink-to-width for wide sheets; one section per visible sheet
- Doc model + export: `src/lib/office-doc.ts` (tabs, page setup, HTML import, export walker) and `src/lib/office-doc-export.ts` (DOCX via `docx`, PDF via `html2canvas` + `jspdf`). Unit test: `npm run test:unit`
- Personal notes: chat room `type = 'self'` (`ensureSelfRoom` in `chat-actions.ts`), select mode in `chat-window`; admins cannot read it
- Exports: `src/lib/document-export.ts` (DOCX via `docx`, PDF via `jspdf`, XLSX via `xlsx`)

## Known limitations

- Import (Univer's native import is Pro): DOCX loses paragraph alignment and text colour (mammoth doesn't read them), plus headers/footers and comments. XLSX loses charts, images, conditional formats, and theme colours. Old binary .doc files are not supported.
- Presentations (Univer Slides) were built and then removed at the user's request on 2026-10-02.

- Personal-notes PDF (from chat) uses jsPDF text: emoji are dropped. Office doc PDFs are rendered as images (fonts, emoji, tables, images kept; text not selectable).
- Univer's own DOCX/PDF exchange and print are paid Pro features, so Office exports are our own converters: header/footer, shapes, and floating-image positions are not exported; images on other domains export only if they allow CORS.
- Images inserted in docs are stored inline (base64) in the file snapshot, so very large images make saves heavier.
- `.xlsx` export writes values and formulas, not cell styling (import does keep styling, via exceljs).
- Sheet PDFs are images per page (text not selectable), print light gridlines, and don't include charts, images, or conditional formatting; there is no print-area / page-setup choice yet.
- Univer sheets are single-editor: two people editing the same sheet at once will overwrite each other (last save wins). Real-time collaboration is also Pro.
