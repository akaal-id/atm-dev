-- Office: presentations (Univer Slides) were tried and removed on 2026-10-02.
-- Restores the original type check; no 'slide' rows existed when this ran.
alter table public.office_files drop constraint if exists office_files_type_check;
alter table public.office_files add constraint office_files_type_check check (type in ('sheet', 'doc'));
