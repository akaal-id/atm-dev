-- Project Hub — Phase 4: Office files (see docs/project-hub-plan.md)
-- Additive only. Every file lives in a project unless it is the owner's personal note.

create table if not exists public.office_files (
  file_id text primary key,
  company_id text not null,
  scope text not null check (scope in ('project', 'personal')),
  project_id text references public.projects (project_id) on delete cascade,
  owner_user_id text not null references public.users (user_id) on delete cascade,
  type text not null check (type in ('sheet', 'doc')),
  title text not null,
  folder text not null default '',
  snapshot jsonb,                       -- Univer workbook data (type = 'sheet')
  content text not null default '',     -- rich-text HTML (type = 'doc')
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_files_location_check check (
    (scope = 'project' and project_id is not null) or (scope = 'personal' and project_id is null)
  )
);

create index if not exists office_files_project_idx on public.office_files (project_id, folder, title) where scope = 'project';
create index if not exists office_files_personal_idx on public.office_files (owner_user_id, title) where scope = 'personal';

alter table public.office_files enable row level security;
