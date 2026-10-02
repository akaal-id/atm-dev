-- Project Hub — Phase 3: social media dashboard (see docs/project-hub-plan.md)
-- Additive only.

create table if not exists public.audience_personas (
  persona_id text primary key,
  project_id text not null references public.projects (project_id) on delete cascade,
  company_id text not null,
  name text not null,
  age_range text not null default '',
  gender text not null default '',
  location text not null default '',
  occupation text not null default '',
  description text not null default '',
  interests text not null default '',
  pain_points text not null default '',
  goals text not null default '',
  channels text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audience_personas_project_idx on public.audience_personas (project_id, sort_order);

-- Campaign status (upcoming / running / done) is derived from the dates.
create table if not exists public.campaigns (
  campaign_id text primary key,
  project_id text not null references public.projects (project_id) on delete cascade,
  company_id text not null,
  name text not null,
  objective text not null default '',
  channel text not null default '',
  start_date text not null default '', -- YYYY-MM-DD
  end_date text not null default '',   -- YYYY-MM-DD
  budget numeric,
  brief_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_project_idx on public.campaigns (project_id, start_date);

alter table public.audience_personas enable row level security;
alter table public.campaigns enable row level security;
