-- Akaal Team Management Supabase schema
-- Run this in Supabase Dashboard > SQL Editor before switching ATM_DATA_MODE to "supabase".
-- The app writes through server-side API routes with SUPABASE_SECRET_KEY, so RLS is enabled
-- without public policies to keep browser/client keys from reading or writing tables directly.

begin;

create table if not exists public.users (
  user_id text primary key,
  full_name text not null default '',
  email text not null default '',
  password_hash_or_auth_id text not null default '',
  profile_photo text not null default '',
  bio text not null default '',
  phone text not null default '',
  department_id text not null default '',
  position text not null default '',
  employment_status text not null default '',
  role_id text not null default 'employee',
  birthday text not null default '',
  join_date text not null default '',
  is_active boolean not null default false,
  signup_status text not null default '',
  signup_provider text not null default 'password',
  verification_key_hash text not null default '',
  verification_expires_at text not null default '',
  requested_at text not null default '',
  approved_at text not null default '',
  rejected_at text not null default '',
  rejection_reason text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.departments (
  department_id text primary key,
  department_name text not null default '',
  leader_user_id text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.roles (
  role_id text primary key,
  role_name text not null default '',
  description text not null default '',
  permissions_json jsonb not null default '[]'::jsonb,
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.projects (
  project_id text primary key,
  ticket_id_prefix text not null default '',
  project_name text not null default '',
  description text not null default '',
  owner_user_id text not null default '',
  members jsonb not null default '[]'::jsonb,
  priority text not null default 'Medium',
  status text not null default 'Not Started',
  progress integer not null default 0,
  notes text not null default '',
  links jsonb not null default '[]'::jsonb,
  deadline text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.tasks (
  task_id text primary key,
  title text not null default '',
  description text not null default '',
  project_id text not null default '',
  assigned_by text not null default '',
  assigned_to jsonb not null default '[]'::jsonb,
  priority text not null default 'Medium',
  status text not null default 'To Do',
  due_date text not null default '',
  progress integer not null default 0,
  labels jsonb not null default '[]'::jsonb,
  need_leader_approval boolean not null default false,
  created_at text not null default '',
  updated_at text not null default '',
  completed_at text not null default '',
  handed_off_at text not null default ''
);

create table if not exists public.task_comments (
  comment_id text primary key,
  task_id text not null default '',
  user_id text not null default '',
  comment text not null default '',
  mentions jsonb not null default '[]'::jsonb,
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.task_checklists (
  checklist_id text primary key,
  task_id text not null default '',
  title text not null default '',
  is_completed boolean not null default false,
  assignee_completed boolean not null default false,
  assignee_completed_by text not null default '',
  pm_approved boolean not null default false,
  pm_approved_by text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.attendance (
  attendance_id text primary key,
  user_id text not null default '',
  date text not null default '',
  clock_in text not null default '',
  clock_out text not null default '',
  active_minutes integer not null default 0,
  location_count integer not null default 0,
  status text not null default 'Present',
  note text not null default '',
  approval_status text not null default 'Not Required',
  approved_by text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.leave_requests (
  request_id text primary key,
  user_id text not null default '',
  request_type text not null default '',
  start_date text not null default '',
  end_date text not null default '',
  reason text not null default '',
  attachment_url text not null default '',
  status text not null default 'Pending Approval',
  approved_by text not null default '',
  approval_note text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.announcements (
  announcement_id text primary key,
  title text not null default '',
  body text not null default '',
  category text not null default 'General',
  target_department text not null default 'all',
  target_users jsonb not null default '[]'::jsonb,
  is_pinned boolean not null default false,
  scheduled_at text not null default '',
  created_by text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.calendar_events (
  event_id text primary key,
  title text not null default '',
  description text not null default '',
  type text not null default '',
  start_date text not null default '',
  end_date text not null default '',
  related_user_id text not null default '',
  related_task_id text not null default '',
  related_project_id text not null default '',
  created_by text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.notifications (
  notification_id text primary key,
  user_id text not null default '',
  title text not null default '',
  description text not null default '',
  type text not null default '',
  related_link text not null default '',
  is_read boolean not null default false,
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.gamification_points (
  point_id text primary key,
  user_id text not null default '',
  source_type text not null default '',
  source_id text not null default '',
  points integer not null default 0,
  reason text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.badges (
  badge_id text primary key,
  badge_name text not null default '',
  description text not null default '',
  icon text not null default '',
  criteria_json jsonb not null default '{}'::jsonb,
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.user_badges (
  user_badge_id text primary key,
  user_id text not null default '',
  badge_id text not null default '',
  earned_at text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.activity_logs (
  log_id text primary key,
  user_id text not null default '',
  action text not null default '',
  entity_type text not null default '',
  entity_id text not null default '',
  description text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

create table if not exists public.settings (
  setting_id text primary key,
  setting_key text not null default '',
  setting_value text not null default '',
  setting_type text not null default 'text',
  updated_by text not null default '',
  created_at text not null default '',
  updated_at text not null default ''
);

alter table public.users enable row level security;
alter table public.departments enable row level security;
alter table public.roles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_checklists enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.announcements enable row level security;
alter table public.calendar_events enable row level security;
alter table public.notifications enable row level security;
alter table public.gamification_points enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;

create unique index if not exists users_email_unique_idx on public.users (lower(email));
create index if not exists users_department_idx on public.users (department_id);
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists task_comments_task_idx on public.task_comments (task_id);
create index if not exists task_checklists_task_idx on public.task_checklists (task_id);
create index if not exists attendance_user_date_idx on public.attendance (user_id, date);
create index if not exists leave_requests_user_idx on public.leave_requests (user_id);
create index if not exists notifications_user_read_idx on public.notifications (user_id, is_read);
create index if not exists gamification_points_user_idx on public.gamification_points (user_id);
create index if not exists activity_logs_created_idx on public.activity_logs (created_at);

commit;

-- Existing Supabase projects can run this migration safely after the original schema:
alter table if exists public.task_checklists add column if not exists assignee_completed boolean not null default false;
alter table if exists public.projects add column if not exists ticket_id_prefix text not null default '';
alter table if exists public.task_checklists add column if not exists assignee_completed_by text not null default '';
alter table if exists public.task_checklists add column if not exists pm_approved boolean not null default false;
alter table if exists public.task_checklists add column if not exists pm_approved_by text not null default '';
alter table if exists public.tasks add column if not exists need_leader_approval boolean not null default false;
update public.task_checklists set assignee_completed = true where is_completed = true and assignee_completed = false;
create index if not exists task_checklists_task_idx on public.task_checklists (task_id);
