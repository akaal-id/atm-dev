-- AKAAL ticket workflow migration
-- Run this once in Supabase Dashboard > SQL Editor for existing ATM databases.

alter table if exists public.task_checklists add column if not exists assignee_completed boolean not null default false;
alter table if exists public.task_checklists add column if not exists assignee_completed_by text not null default '';
alter table if exists public.task_checklists add column if not exists pm_approved boolean not null default false;
alter table if exists public.task_checklists add column if not exists pm_approved_by text not null default '';
alter table if exists public.tasks add column if not exists need_leader_approval boolean not null default false;
alter table if exists public.projects add column if not exists ticket_id_prefix text not null default '';

update public.task_checklists
set assignee_completed = true
where is_completed = true and assignee_completed = false;

create index if not exists task_checklists_task_idx on public.task_checklists (task_id);
