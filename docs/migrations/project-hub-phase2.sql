-- Project Hub — Phase 2: content matrix (see docs/project-hub-plan.md)
-- Additive only. Funnel / pillar / channel / theme are stored as labels so rows
-- survive edits to the project's strategy options.

create table if not exists public.content_items (
  item_id text primary key,
  project_id text not null references public.projects (project_id) on delete cascade,
  company_id text not null,
  task_id text not null default '',
  title text not null,
  brand_id text references public.brands (brand_id) on delete set null,
  month text not null default '',            -- YYYY-MM
  create_date text not null default '',      -- YYYY-MM-DD
  publication_date text not null default '', -- YYYY-MM-DD
  theme text not null default '',
  funnel text not null default '',
  pillar text not null default '',
  channel text not null default '',
  brief_url text not null default '',
  drive_url text not null default '',
  publication_url text not null default '',
  caption text not null default '',
  sort_order integer not null default 0,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_project_idx on public.content_items (project_id, month, sort_order);
create index if not exists content_items_task_idx on public.content_items (task_id) where task_id <> '';

alter table public.content_items enable row level security;
