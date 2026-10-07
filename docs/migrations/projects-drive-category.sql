-- 2026-10-07: where a project's Drive uploads go (Main Akaal 2026 / <Category> / <Project> / <Subfolder> / DDMMYY_file).
alter table public.projects add column if not exists drive_category text;
alter table public.projects drop constraint if exists projects_drive_category_check;
alter table public.projects add constraint projects_drive_category_check check (drive_category is null or drive_category in ('client', 'company', 'event', 'internal_brand'));
comment on column public.projects.drive_category is 'Google Drive top folder for this project''s uploads: client | company | event | internal_brand (Main Akaal 2026 / <Category> / <Project> / ...).';
