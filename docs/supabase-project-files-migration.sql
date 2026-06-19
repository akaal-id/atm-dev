-- Project Files migration
-- Run this once in Supabase Dashboard > SQL Editor.
-- Mirrors the existing table conventions (text columns, RLS enabled, access via the
-- server's service-role key like every other table in this app).

create table if not exists public.project_files (
  file_id text primary key,
  task_id text not null default '',
  project_id text not null default '',
  title text not null default '',
  owner_user_id text not null default '',
  file_url text not null default '',
  file_name text not null default '',
  file_mime text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

alter table public.project_files enable row level security;

create index if not exists project_files_task_idx on public.project_files (task_id);
create index if not exists project_files_project_idx on public.project_files (project_id);
