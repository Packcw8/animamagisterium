alter table public.map_markers
  add column if not exists clear_active_route_on_use boolean not null default false;

comment on column public.map_markers.clear_active_route_on_use is
  'When true, using this marker clears the player current walking path after travel so refresh restores player_map_state instead of route_progress.';
