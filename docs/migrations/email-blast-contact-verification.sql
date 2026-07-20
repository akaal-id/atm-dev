-- email verification status for blast contacts (format + MX check, no Resend send)
-- Applied via Supabase MCP; kept in-repo for reference.

alter table public.contacts
  add column if not exists verification_status text not null default 'unchecked',
  add column if not exists verification_detail text not null default '',
  add column if not exists verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_verification_status_check'
  ) then
    alter table public.contacts
      add constraint contacts_verification_status_check
      check (verification_status in ('unchecked', 'valid', 'invalid', 'unknown'));
  end if;
end $$;

create index if not exists contacts_verification_status_idx on public.contacts (verification_status);
