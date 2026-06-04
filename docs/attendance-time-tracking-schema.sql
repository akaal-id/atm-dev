-- ATM Attendance & Time Tracking
-- Run this in Supabase Dashboard > SQL Editor.
--
-- Note: the current ATM app stores users with text IDs such as "usr_asad".
-- To avoid breaking existing authentication and employee records, user_id is
-- intentionally text here and references public.users(user_id). Session/event
-- IDs remain UUIDs.

create extension if not exists pgcrypto;

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(user_id) on delete cascade,
  date date not null,
  status text not null check (
    status in ('On Time', 'Late', 'Present', 'Leave', 'System Auto-Closed')
  ),
  total_active_minutes integer not null default 0 check (total_active_minutes >= 0),
  eod_summary text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  event_type text not null check (
    event_type in ('clock_in', 'transit_pause', 'resume', 'clock_out')
  ),
  lat double precision not null,
  lng double precision not null,
  "timestamp" timestamptz not null default now()
);

create index if not exists attendance_sessions_user_date_idx
  on public.attendance_sessions (user_id, date desc);

create index if not exists attendance_events_session_timestamp_idx
  on public.attendance_events (session_id, "timestamp" asc);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_events enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.attendance_sessions to service_role;
grant select, insert, update, delete on public.attendance_events to service_role;

-- Security note:
-- This app authorizes attendance through secure Next.js API routes using the
-- server-side Supabase secret/service key. No anon/authenticated grants are
-- added here, so browser clients cannot directly read or write attendance rows.

-- Optional hard cap with pg_cron:
-- 1. Enable pg_cron in Supabase Dashboard > Database > Extensions.
-- 2. Run the schedule below. It marks any session without a clock_out event
--    after 14 hours as System Auto-Closed with an empty EOD summary.
--
-- select cron.schedule(
--   'atm-attendance-auto-close-open-sessions',
--   '0 * * * *',
--   $$
--     update public.attendance_sessions session
--     set
--       status = 'System Auto-Closed',
--       eod_summary = ''
--     where session.created_at < now() - interval '14 hours'
--       and session.status <> 'System Auto-Closed'
--       and not exists (
--         select 1
--         from public.attendance_events event
--         where event.session_id = session.id
--           and event.event_type = 'clock_out'
--       );
--   $$
-- );
