-- Adds the timestamp column expected by reward/progression RPCs.
alter table public.characters
  add column if not exists updated_at timestamp with time zone not null default now();

update public.characters
set updated_at = coalesce(created_at, now())
where updated_at is null;
