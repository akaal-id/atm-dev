-- Handoff timestamp migration (fair overdue rule)
-- Run this once in Supabase Dashboard > SQL Editor.
--
-- Adds public.tasks.handed_off_at, set when a task first reaches the hand-off stage
-- (Waiting Approval / Ready). Overdue is then decided fairly: a task handed off ON OR
-- BEFORE its due date never counts as overdue (no tag, no leaderboard penalty), even if
-- approval drags afterwards. A task that goes past due BEFORE being handed off stays
-- overdue even after it later moves to Waiting Approval.

-- 1) Add the column (mirrors the existing completed_at column convention).
alter table public.tasks
  add column if not exists handed_off_at text not null default '';

-- 2) Backfill already-handed-off, not-yet-finished tasks as "delivered on the deadline" so
--    the new rule doesn't retroactively flag legitimately in-flight work as overdue.
--    Terminal tasks (Finished/Done/Approved/etc.) are never overdue anyway, so they're skipped.
update public.tasks
set handed_off_at = due_date
where handed_off_at = ''
  and due_date <> ''
  and status in ('Waiting Approval', 'Ready');
