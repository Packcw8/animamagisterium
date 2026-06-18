alter table public.map_events
add column if not exists linked_only boolean not null default false;

update public.map_events
set linked_only = true
where id in (
  select distinct battle_event_id
  from public.story_dialogue_choices
  where battle_event_id is not null
);
