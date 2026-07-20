-- contact groups for email blast recipients
-- Applied via Supabase MCP; kept in-repo for reference.

create table if not exists public.contact_groups (
  id text primary key,
  user_id text not null references public.users(user_id),
  group_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists contact_groups_user_id_idx on public.contact_groups (user_id);
alter table public.contact_groups enable row level security;
