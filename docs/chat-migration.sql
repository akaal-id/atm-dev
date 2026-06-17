-- ============================================================================
-- Akaal Team Management — Live Chat migration
-- Tables: chat_rooms, room_members, messages (+ indexes, triggers, RLS)
--
-- IMPORTANT NOTES
-- 1. Primary keys are TEXT (matching public.users.user_id and public.tasks.task_id).
-- 2. All writes happen through server actions using SUPABASE_SECRET_KEY, which
--    bypasses RLS. RLS below is defense-in-depth + a working setup for Realtime.
-- 3. This app does NOT use Supabase Auth, so the browser (anon key) cannot be
--    identified per-user on the Realtime websocket. Two RLS modes are provided:
--      (A) PRAGMATIC (active)  — anon may SELECT so postgres_changes can stream
--                                rows to subscribed clients. Writes are blocked
--                                for anon/authenticated and only done server-side.
--      (B) STRICT (commented)  — membership-scoped, for when/if you adopt
--                                Supabase Auth (auth.uid()::text == user_id).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.chat_rooms (
  room_id     text primary key,
  name        text not null default '',           -- group name; for private chats UI derives the title
  type        text not null default 'group',      -- 'private' | 'group'
  avatar_url  text not null default '',
  created_by  text not null references public.users (user_id) on delete cascade,
  last_message_at timestamptz,                     -- denormalized for room-list ordering
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.room_members (
  member_id  text primary key,
  room_id    text not null references public.chat_rooms (room_id) on delete cascade,
  user_id    text not null references public.users (user_id) on delete cascade,
  role       text not null default 'member',       -- 'admin' | 'member'
  joined_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.messages (
  message_id   text primary key,
  room_id      text not null references public.chat_rooms (room_id) on delete cascade,
  sender_id    text not null references public.users (user_id) on delete cascade,
  type         text not null default 'text',       -- 'text' | 'file' | 'task' | 'system'
  content      text not null default '',           -- TipTap HTML
  -- File attachments (Google Drive direct upload)
  file_url     text,                               -- Drive webViewLink
  file_name    text,
  file_mime    text,
  -- Task call integration. FK is TEXT and nullable (set null if task is deleted).
  task_id      text references public.tasks (task_id) on delete set null,
  -- Scraped Open Graph metadata for the first link in the message
  link_preview jsonb,
  reply_to     text references public.messages (message_id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_room_members_user on public.room_members (user_id);
create index if not exists idx_room_members_room on public.room_members (room_id);
create index if not exists idx_messages_room_created on public.messages (room_id, created_at);
create index if not exists idx_messages_sender on public.messages (sender_id);
create index if not exists idx_chat_rooms_last_message on public.chat_rooms (last_message_at desc nulls last);

-- ---------------------------------------------------------------------------
-- Triggers: keep updated_at fresh + bump chat_rooms.last_message_at on new msg
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_chat_rooms_updated_at on public.chat_rooms;
create trigger trg_chat_rooms_updated_at
  before update on public.chat_rooms
  for each row execute function public.set_updated_at();

create or replace function public.bump_room_last_message()
returns trigger language plpgsql as $$
begin
  update public.chat_rooms
     set last_message_at = new.created_at,
         updated_at = now()
   where room_id = new.room_id;
  return new;
end;
$$;

drop trigger if exists trg_messages_bump_room on public.messages;
create trigger trg_messages_bump_room
  after insert on public.messages
  for each row execute function public.bump_room_last_message();

-- ---------------------------------------------------------------------------
-- Realtime: stream INSERTs on messages to subscribed browser clients
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.room_members;

-- ---------------------------------------------------------------------------
-- RLS — MODE (A): PRAGMATIC / SERVER-AUTHORITATIVE  (active)
-- ---------------------------------------------------------------------------
-- Writes are performed exclusively by server actions using the service/secret
-- key (which bypasses RLS). The anon role is granted SELECT only, so the
-- Realtime websocket can deliver new rows to clients that already loaded a room
-- through the server (where membership was verified). No write policies exist
-- for anon/authenticated, so direct client writes are rejected.

alter table public.chat_rooms   enable row level security;
alter table public.room_members enable row level security;
alter table public.messages     enable row level security;

drop policy if exists "read_messages_for_realtime"  on public.messages;
drop policy if exists "read_rooms_for_realtime"      on public.chat_rooms;
drop policy if exists "read_members_for_realtime"    on public.room_members;

create policy "read_messages_for_realtime"
  on public.messages for select
  to anon, authenticated
  using (true);

create policy "read_rooms_for_realtime"
  on public.chat_rooms for select
  to anon, authenticated
  using (true);

create policy "read_members_for_realtime"
  on public.room_members for select
  to anon, authenticated
  using (true);

-- (No INSERT/UPDATE/DELETE policies => all client-side writes are blocked.
--  service_role used by the server bypasses RLS entirely.)

-- ---------------------------------------------------------------------------
-- RLS — MODE (B): STRICT MEMBERSHIP  (commented — enable with Supabase Auth)
-- ---------------------------------------------------------------------------
-- Adopt these if you migrate to Supabase Auth so that auth.uid()::text equals
-- public.users.user_id, OR mint a Supabase-compatible JWT whose `sub` claim is
-- the user_id. Then a normal user may only read/insert within rooms they belong
-- to, while admins (by an `app_role` JWT claim) bypass the membership check.
--
-- -- helper: is the requester a member of the room?
-- create or replace function public.is_room_member(p_room_id text)
-- returns boolean language sql stable security definer set search_path = public as $$
--   select exists (
--     select 1 from public.room_members rm
--      where rm.room_id = p_room_id
--        and rm.user_id = auth.uid()::text
--   );
-- $$;
--
-- -- helper: does the requester carry an admin/super_admin role claim?
-- create or replace function public.is_chat_admin()
-- returns boolean language sql stable as $$
--   select coalesce(
--     (auth.jwt() -> 'app_metadata' ->> 'role_id') in ('admin','super_admin'),
--     false
--   );
-- $$;
--
-- alter policy "read_messages_for_realtime" on public.messages rename to "members_select_messages";
-- drop policy if exists "members_select_messages" on public.messages;
-- create policy "members_select_messages" on public.messages for select to authenticated
--   using (public.is_chat_admin() or public.is_room_member(room_id));
-- create policy "members_insert_messages" on public.messages for insert to authenticated
--   with check (sender_id = auth.uid()::text and (public.is_chat_admin() or public.is_room_member(room_id)));
--
-- create policy "members_select_rooms" on public.chat_rooms for select to authenticated
--   using (public.is_chat_admin() or public.is_room_member(room_id));
-- create policy "members_select_members" on public.room_members for select to authenticated
--   using (public.is_chat_admin() or public.is_room_member(room_id));
