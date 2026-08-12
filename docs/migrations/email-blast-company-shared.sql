-- Share contact groups + email blasts across company members.
-- company_id scopes visibility; user_id remains the creator ("Created by").
-- Applied via Supabase MCP; kept in-repo for reference.

alter table public.contact_groups
  add column if not exists company_id text not null default '';

alter table public.email_blasts
  add column if not exists company_id text not null default '';

update public.contact_groups cg
set company_id = coalesce(
  (
    select cu.company_id
    from public.company_users cu
    where cu.user_id = cg.user_id
    order by cu.created_at asc nulls last
    limit 1
  ),
  'cmp_akaal'
)
where cg.company_id is null or cg.company_id = '';

update public.email_blasts eb
set company_id = coalesce(
  (
    select cu.company_id
    from public.company_users cu
    where cu.user_id = eb.user_id
    order by cu.created_at asc nulls last
    limit 1
  ),
  'cmp_akaal'
)
where eb.company_id is null or eb.company_id = '';

create index if not exists contact_groups_company_id_idx on public.contact_groups (company_id);
create index if not exists email_blasts_company_id_idx on public.email_blasts (company_id);
