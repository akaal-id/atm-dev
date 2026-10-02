-- Project Hub — Phase 5: personal notes room (see docs/project-hub-plan.md)
-- chat_rooms.type gains the value 'self' (no check constraint exists). One per user.

create unique index if not exists chat_rooms_one_self_per_user on public.chat_rooms (created_by) where type = 'self';
