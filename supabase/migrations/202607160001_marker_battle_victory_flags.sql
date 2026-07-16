alter table public.map_markers
  add column if not exists victory_story_flag_key text,
  add column if not exists victory_story_flag_value boolean not null default true;

create index if not exists map_markers_victory_story_flag_idx
  on public.map_markers(victory_story_flag_key)
  where victory_story_flag_key is not null;
