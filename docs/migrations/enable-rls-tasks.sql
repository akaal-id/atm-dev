-- Close public REST access to tasks (Supabase advisor 0013 "RLS Disabled in Public").
-- The app reads/writes these tables only server-side with the secret key, which bypasses RLS,
-- so no policies are needed — same pattern as every other public table.

alter table public.tasks enable row level security;
alter table public.task_checklists enable row level security;
