alter table public.map_routes
  add column if not exists lock_type text not null default 'public',
  add column if not exists lock_message text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'map_routes_lock_type_check'
  ) then
    alter table public.map_routes
      add constraint map_routes_lock_type_check
      check (lock_type in ('public', 'story_locked', 'quest_locked'));
  end if;
end $$;

alter table public.map_markers
  add column if not exists lock_type text not null default 'public',
  add column if not exists lock_message text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'map_markers_lock_type_check'
  ) then
    alter table public.map_markers
      add constraint map_markers_lock_type_check
      check (lock_type in ('public', 'story_locked', 'quest_locked'));
  end if;
end $$;

alter table public.player_abilities
  alter column unlocked_by_attribute drop not null;

alter table public.player_abilities
  drop constraint if exists player_abilities_unlocked_by_attribute_check;

alter table public.player_abilities
  add constraint player_abilities_unlocked_by_attribute_check
  check (
    unlocked_by_attribute is null
    or unlocked_by_attribute in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')
  );
