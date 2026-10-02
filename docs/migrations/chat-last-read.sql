-- Chat unread badges (2026-10-02): when each member last opened the room. Additive.
alter table public.room_members add column if not exists last_read_at timestamptz;
