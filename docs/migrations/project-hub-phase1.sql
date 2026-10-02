-- Project Hub — Phase 1 (see docs/project-hub-plan.md)
-- Additive only: new nullable/defaulted columns and new tables. Safe to re-run.

-- 1. Project header fields
alter table public.projects
  add column if not exists project_type text not null default 'general',
  add column if not exists period_start text not null default '',
  add column if not exists period_end text not null default '',
  add column if not exists objective text not null default '',
  add column if not exists pic_user_id text not null default '',
  add column if not exists sop_content text not null default '';

alter table public.projects drop constraint if exists projects_project_type_check;
alter table public.projects
  add constraint projects_project_type_check check (project_type in ('general', 'social_media'));

-- 2. Project file categories (base files, SOP attachments)
alter table public.project_files
  add column if not exists category text not null default 'general';

alter table public.project_files drop constraint if exists project_files_category_check;
alter table public.project_files
  add constraint project_files_category_check check (category in ('general', 'base', 'sop'));

-- 3. Brand master (company level) with sub-brands
create table if not exists public.brands (
  brand_id text primary key,
  company_id text not null,
  parent_brand_id text references public.brands (brand_id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brands_company_idx on public.brands (company_id);

create table if not exists public.project_brands (
  project_id text not null references public.projects (project_id) on delete cascade,
  brand_id text not null references public.brands (brand_id) on delete cascade,
  company_id text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, brand_id)
);
create index if not exists project_brands_brand_idx on public.project_brands (brand_id);

-- 4. Strategy options: funnel / pillar / channel / theme per project
create table if not exists public.project_strategy_options (
  option_id text primary key,
  project_id text not null references public.projects (project_id) on delete cascade,
  company_id text not null,
  type text not null check (type in ('funnel', 'pillar', 'channel', 'theme')),
  label text not null,
  description text not null default '',
  target_share numeric check (target_share is null or (target_share >= 0 and target_share <= 100)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_strategy_options_project_idx on public.project_strategy_options (project_id, type, sort_order);

-- 5. KPI targets vs actuals
create table if not exists public.project_kpis (
  kpi_id text primary key,
  project_id text not null references public.projects (project_id) on delete cascade,
  company_id text not null,
  name text not null,
  unit text not null default '',
  target_value numeric not null default 0,
  actual_value numeric not null default 0,
  channel text not null default '',
  funnel text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_kpis_project_idx on public.project_kpis (project_id, sort_order);

-- Server-only access (secret key bypasses RLS), matching existing tables.
alter table public.brands enable row level security;
alter table public.project_brands enable row level security;
alter table public.project_strategy_options enable row level security;
alter table public.project_kpis enable row level security;
