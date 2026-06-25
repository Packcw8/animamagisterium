alter table public.map_markers
  add column if not exists reward_full_heal boolean not null default false;
