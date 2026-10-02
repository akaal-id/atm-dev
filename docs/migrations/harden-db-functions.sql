-- Resolve Supabase advisor warnings 0011 / 0028 / 0029.

-- rls_auto_enable() backs the `ensure_rls` event trigger (auto-enables RLS on new public tables).
-- Event triggers fire regardless of EXECUTE privilege, so nobody needs to call it over /rest/v1/rpc.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Trigger functions: pin search_path (bodies already use schema-qualified names).
alter function public.set_updated_at() set search_path = '';
alter function public.bump_room_last_message() set search_path = '';
alter function public.bump_ai_conversation_last_message() set search_path = '';
