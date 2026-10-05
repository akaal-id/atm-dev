-- Web Push (2026-10-05): one row per browser/device that allowed notifications. Additive.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id text not null,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
-- Server-only (secret key); no client access.
alter table public.push_subscriptions enable row level security;
