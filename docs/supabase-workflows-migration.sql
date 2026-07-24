-- Workflows board entity + task.workflow_id link
-- Applied via Supabase MCP (create_workflows_table). Kept here for docs / local replay.

create table if not exists public.workflows (
  workflow_id text primary key,
  name text not null default '',
  description text not null default '',
  status text not null default 'Not Started',
  project_id text not null default '',
  company_id text not null default '',
  columns jsonb not null default '[]'::jsonb,
  sprint_start text not null default '',
  sprint_end text not null default '',
  ticket_id_prefix text not null default '',
  template_id text not null default '',
  template_name text not null default '',
  inherit_project_tasks boolean not null default false,
  created_at text not null default '',
  updated_at text not null default ''
);

alter table public.workflows enable row level security;

create index if not exists workflows_company_idx on public.workflows (company_id);
create index if not exists workflows_project_idx on public.workflows (project_id);

alter table public.tasks add column if not exists workflow_id text;
create index if not exists tasks_workflow_id_idx on public.tasks (workflow_id);

-- Later: add_workflows_status
-- alter table public.workflows add column if not exists status text not null default 'Not Started';
