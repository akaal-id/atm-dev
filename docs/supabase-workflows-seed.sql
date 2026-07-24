-- Seed board workflows (idempotent upserts).
insert into public.workflows (
  workflow_id, name, description, project_id, company_id, columns,
  sprint_start, sprint_end, ticket_id_prefix, template_id, template_name,
  inherit_project_tasks, created_at, updated_at
)
select
  x.workflow_id,
  x.name,
  x.description,
  x.project_id,
  'cmp_akaal',
  x.columns::jsonb,
  '', '', '', '', '',
  false,
  '2026-07-24T00:00:00.000Z',
  '2026-07-24T00:00:00.000Z'
from (
  values
    ('wf_hei_sosmed', 'HEI Sosmed and others', 'Halal Expo Indonesia - social content and non-website delivery.', 'prj_c42905a8', '[{"id":"wfc_todo","name":"To Do","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_progress","name":"In Progress","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_waiting","name":"Waiting Approval","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_ready","name":"Ready","order_index":3,"is_2stage_approval_trigger":false},{"id":"wfc_finished","name":"Finished","order_index":4,"is_2stage_approval_trigger":false}]'),
    ('wf_hei_website', 'HEI Website', 'Halal Expo Indonesia - website, portal, and registration web work.', 'prj_c42905a8', '[{"id":"wfc_todo","name":"To Do","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_progress","name":"In Progress","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_waiting","name":"Waiting Approval","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_ready","name":"Ready","order_index":3,"is_2stage_approval_trigger":false},{"id":"wfc_finished","name":"Finished","order_index":4,"is_2stage_approval_trigger":false}]'),
    ('wf_akaal_labs_website', 'Akaal Labs Website', 'Akaal.com website / CMS / portfolio FE work from Labs.', 'prj_9dcd3c71', '[{"id":"wfc_todo","name":"To Do","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_progress","name":"In Progress","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_waiting","name":"Waiting Approval","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_ready","name":"Ready","order_index":3,"is_2stage_approval_trigger":false},{"id":"wfc_finished","name":"Finished","order_index":4,"is_2stage_approval_trigger":false}]'),
    ('wf_akaal_labs_content', 'Akaal Labs Content', 'Labs marketing content and social copy.', 'prj_9dcd3c71', '[{"id":"wfc_cs_brief","name":"Brief","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_cs_draft","name":"Drafting","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_cs_review","name":"Review","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_cs_done","name":"Published","order_index":3,"is_2stage_approval_trigger":false}]'),
    ('wf_akaal_labs_product', 'Akaal Labs Product', 'ATM / product engineering tasks from Labs.', 'prj_9dcd3c71', '[{"id":"wfc_todo","name":"To Do","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_progress","name":"In Progress","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_waiting","name":"Waiting Approval","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_ready","name":"Ready","order_index":3,"is_2stage_approval_trigger":false},{"id":"wfc_finished","name":"Finished","order_index":4,"is_2stage_approval_trigger":false}]'),
    ('wf_akaal_labs_misc', 'Akaal Labs Misc', 'Labs test tickets and uncategorized items.', 'prj_9dcd3c71', '[{"id":"wfc_ops_open","name":"Open","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_ops_doing","name":"Doing","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_ops_done","name":"Done","order_index":2,"is_2stage_approval_trigger":false}]'),
    ('wf_akaal_studio_content', 'Akaal Studio Content', 'Studio visual content and brand storytelling posts.', 'prj_b3e857e9', '[{"id":"wfc_cs_brief","name":"Brief","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_cs_draft","name":"Drafting","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_cs_review","name":"Review","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_cs_done","name":"Published","order_index":3,"is_2stage_approval_trigger":false}]'),
    ('wf_akaal_creative_portfolio', 'Akaal Creative Portfolio', 'Creative portfolio, web assets, decks, and pricelist.', 'prj_f6e94f46', '[{"id":"wfc_cs_brief","name":"Brief","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_cs_draft","name":"Drafting","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_cs_review","name":"Review","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_cs_done","name":"Published","order_index":3,"is_2stage_approval_trigger":false}]'),
    ('wf_akaal_creative_content', 'Akaal Creative Content', 'Creative social content and carousels.', 'prj_f6e94f46', '[{"id":"wfc_cs_brief","name":"Brief","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_cs_draft","name":"Drafting","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_cs_review","name":"Review","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_cs_done","name":"Published","order_index":3,"is_2stage_approval_trigger":false}]'),
    ('wf_akaal_id_offering', 'AKAAL-ID Offering Decks', 'Pitch research and client offering decks.', 'prj_33d5fb6f', '[{"id":"wfc_todo","name":"To Do","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_progress","name":"In Progress","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_waiting","name":"Waiting Approval","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_ready","name":"Ready","order_index":3,"is_2stage_approval_trigger":false},{"id":"wfc_finished","name":"Finished","order_index":4,"is_2stage_approval_trigger":false}]'),
    ('wf_bfriends_web', 'BFriends Website', 'BLife BFriends website updates.', 'prj_93b29f9d', '[{"id":"wfc_todo","name":"To Do","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_progress","name":"In Progress","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_waiting","name":"Waiting Approval","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_ready","name":"Ready","order_index":3,"is_2stage_approval_trigger":false},{"id":"wfc_finished","name":"Finished","order_index":4,"is_2stage_approval_trigger":false}]'),
    ('wf_bnesta_web', 'BNesta Website', 'BLife BNesta website updates.', 'prj_2698319f', '[{"id":"wfc_todo","name":"To Do","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_progress","name":"In Progress","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_waiting","name":"Waiting Approval","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_ready","name":"Ready","order_index":3,"is_2stage_approval_trigger":false},{"id":"wfc_finished","name":"Finished","order_index":4,"is_2stage_approval_trigger":false}]'),
    ('wf_selatox_web', 'Selatox Website', 'Selatox Bio Pharma frontend / website finishing.', 'prj_14ed2750', '[{"id":"wfc_todo","name":"To Do","order_index":0,"is_2stage_approval_trigger":false},{"id":"wfc_progress","name":"In Progress","order_index":1,"is_2stage_approval_trigger":false},{"id":"wfc_waiting","name":"Waiting Approval","order_index":2,"is_2stage_approval_trigger":true},{"id":"wfc_ready","name":"Ready","order_index":3,"is_2stage_approval_trigger":false},{"id":"wfc_finished","name":"Finished","order_index":4,"is_2stage_approval_trigger":false}]')
) as x(workflow_id, name, description, project_id, columns)
on conflict (workflow_id) do update set
  name = excluded.name,
  description = excluded.description,
  project_id = excluded.project_id,
  company_id = excluded.company_id,
  columns = excluded.columns,
  updated_at = excluded.updated_at;
