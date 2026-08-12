-- AI assistant: conversations, messages, and per-user profile memory
-- Applied via Supabase MCP / SQL editor; kept in-repo for reference.
-- Writes go through server actions with SUPABASE_SECRET_KEY (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.ai_conversations (
  conversation_id   text primary key,
  user_id           text not null references public.users (user_id) on delete cascade,
  company_id        text not null default '',
  title             text not null default 'Chat baru',
  last_message_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.ai_messages (
  message_id        text primary key,
  conversation_id   text not null references public.ai_conversations (conversation_id) on delete cascade,
  role              text not null check (role in ('user', 'assistant', 'system')),
  parts             jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

create table if not exists public.ai_user_memory (
  user_id     text primary key references public.users (user_id) on delete cascade,
  summary     text not null default '',
  facts       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_ai_conversations_user_last
  on public.ai_conversations (user_id, last_message_at desc nulls last);

create index if not exists idx_ai_messages_conversation_created
  on public.ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_conversations_updated_at on public.ai_conversations;
create trigger trg_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create or replace function public.bump_ai_conversation_last_message()
returns trigger language plpgsql as $$
begin
  update public.ai_conversations
     set last_message_at = new.created_at,
         updated_at = now()
   where conversation_id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_ai_messages_bump_conversation on public.ai_messages;
create trigger trg_ai_messages_bump_conversation
  after insert on public.ai_messages
  for each row execute function public.bump_ai_conversation_last_message();

-- ---------------------------------------------------------------------------
-- RLS — server-authoritative (no client policies; service role bypasses)
-- ---------------------------------------------------------------------------

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_user_memory enable row level security;
