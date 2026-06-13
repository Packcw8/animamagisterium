alter table public.map_events
  drop constraint if exists map_events_event_type_check;

alter table public.map_events
  add constraint map_events_event_type_check
  check (event_type in ('story', 'dialogue', 'battle', 'clue', 'reward'));
