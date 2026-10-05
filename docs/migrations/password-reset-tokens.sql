-- Forgot password (2026-10-05): one-time reset links sent by email. Additive.
-- Only the SHA-256 of the token is stored; links expire after 1 hour and work once.
create table if not exists public.password_reset_tokens (
  token_hash text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_tokens_user_idx on public.password_reset_tokens (user_id, created_at desc);
alter table public.password_reset_tokens enable row level security;
