-- contacts (group members) for email blast
-- Applied via Supabase MCP; kept in-repo for reference.

create table if not exists public.contacts (
  id text primary key,
  group_id text not null references public.contact_groups(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists contacts_group_id_idx on public.contacts (group_id);
alter table public.contacts enable row level security;
