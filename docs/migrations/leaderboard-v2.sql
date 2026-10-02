-- Leaderboard v2 (2026-10-02): weighted, shared, quality-aware task credit. Additive only.
-- Plan: docs/leaderboard-plan.md. Work types, targets and weights live in settings key `gamification_v2`.
alter table public.tasks
  add column if not exists work_type_id text not null default '',
  add column if not exists effort_points numeric,
  add column if not exists pic_user_id text not null default '',
  add column if not exists contribution_shares jsonb not null default '{}'::jsonb,
  add column if not exists revision_count integer not null default 0,
  add column if not exists quality_rating integer check (quality_rating between 1 and 5);

alter table public.users
  add column if not exists score_track text not null default '';
