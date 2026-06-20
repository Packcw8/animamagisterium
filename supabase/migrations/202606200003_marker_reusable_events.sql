alter table public.map_markers
  add column if not exists dialogue_event_id uuid references public.map_events(id) on delete set null,
  add column if not exists battle_event_id uuid references public.map_events(id) on delete set null;

create index if not exists map_markers_dialogue_event_id_idx
  on public.map_markers(dialogue_event_id);

create index if not exists map_markers_battle_event_id_idx
  on public.map_markers(battle_event_id);
