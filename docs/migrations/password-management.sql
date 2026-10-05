-- Password management (2026-10-05): admin reset + self-service change. Additive.
-- must_change_password: set by an admin reset; the user must pick a new password before using ATM.
-- password_changed_at: sessions issued before this time are rejected (a reset logs out old sessions).
alter table public.users
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_changed_at timestamptz;
