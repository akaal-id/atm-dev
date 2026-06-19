-- Overdue task status + penalty migration
-- Run this once in Supabase Dashboard > SQL Editor.
--
-- NOTE: No table/column changes are required.
--   * public.tasks.status is a plain `text` column (no enum / CHECK constraint),
--     so it already accepts the derived "Overdue" value used by the board.
--   * public.gamification_points.points is `integer`, so it already accepts the
--     negative deduction rows ("task_overdue") created by the leaderboard sync.
--
-- This script only seeds/updates the configurable point rule so existing
-- databases get the overdue deduction (default -20). Adjust the value to taste.

-- 1) Ensure a gamification_rules row exists, then merge in the overdueTask key
--    (preserving any rule values already configured by an admin).
insert into public.settings (setting_id, setting_key, setting_value, setting_type, created_at, updated_at)
values (
  'set_points',
  'gamification_rules',
  '{"completeTask":50,"punctualAttendance":10,"earlyTask":25,"helpfulComment":10,"lateTask":-20,"rejectedTask":-30,"overdueTask":-20}',
  'json',
  now()::text,
  now()::text
)
on conflict (setting_id) do update
set setting_value = (
      (
        case
          when public.settings.setting_value ~ '^\s*\{' then public.settings.setting_value::jsonb
          else '{}'::jsonb
        end
      ) || jsonb_build_object('overdueTask', -20)
    )::text,
    updated_at = now()::text;

-- 2) (Optional) Helpful index for due-date scans if not already present.
create index if not exists tasks_due_date_idx on public.tasks (due_date);
