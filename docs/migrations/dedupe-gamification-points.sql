-- 2026-10-02: remove duplicate point awards and make them impossible.
-- Cause: syncLeaderboardPoints / awardPointsOnce checked "already awarded" against a
-- list capped at PostgREST's 1000 rows, so every leaderboard visit re-inserted awards.
-- Keeps the earliest row per (user_id, source_type, source_id); duplicates are backed up first.

create table if not exists public.gamification_points_duplicates_backup as
select * from (
  select p.*, row_number() over (partition by user_id, source_type, source_id order by created_at, point_id) as rn
  from public.gamification_points p
) ranked where rn > 1;

alter table public.gamification_points_duplicates_backup enable row level security;

delete from public.gamification_points p
using public.gamification_points_duplicates_backup d
where p.point_id = d.point_id;

alter table public.gamification_points
  add constraint gamification_points_award_unique unique (user_id, source_type, source_id);
