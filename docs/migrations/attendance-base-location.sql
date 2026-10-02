-- Attendance rework (2026-10-02): base locations, work mode, EOD task links. Additive only.

-- Each user's office and home base, set by the user (attendance page / profile).
alter table public.users
  add column if not exists office_lat double precision,
  add column if not exists office_lng double precision,
  add column if not exists office_label text not null default '',
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision,
  add column if not exists home_label text not null default '';

-- Where the user clocked in from: WFO (≤ office radius), WFH (≤ 500 m from home), or Off-site.
alter table public.attendance_sessions
  add column if not exists work_mode text check (work_mode in ('WFO', 'WFH', 'Off-site')),
  add column if not exists base_distance_m integer,
  add column if not exists eod_task_ids jsonb not null default '[]'::jsonb;
