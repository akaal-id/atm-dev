-- email blast recipient rows (paired with public.email_blasts)
-- Applied via Supabase MCP; kept in-repo for reference.

create table if not exists public.blast_recipients (
  id text primary key,
  blast_id text not null references public.email_blasts(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending',
  error text not null default '',
  resend_id text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists blast_recipients_blast_id_idx on public.blast_recipients (blast_id);

alter table public.blast_recipients enable row level security;
