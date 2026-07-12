alter table public.player_map_state
  add column if not exists active_season_number integer not null default 1,
  add column if not exists active_chapter_number integer not null default 1;

alter table public.player_map_state
  drop constraint if exists player_map_state_active_season_number_check,
  drop constraint if exists player_map_state_active_chapter_number_check;

alter table public.player_map_state
  add constraint player_map_state_active_season_number_check check (active_season_number > 0),
  add constraint player_map_state_active_chapter_number_check check (active_chapter_number > 0);
