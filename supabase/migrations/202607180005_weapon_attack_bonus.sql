alter table public.item_definitions
  add column if not exists attack_bonus integer not null default 0;
