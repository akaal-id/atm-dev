-- company field for blast contacts, used to personalize email blasts per recipient
-- Applied via Supabase MCP; kept in-repo for reference.

alter table public.contacts
  add column if not exists company text not null default '';

-- Backfill existing contacts (all had no company before this column existed).
update public.contacts set company = 'Asia Karya Lumina' where company = '';
