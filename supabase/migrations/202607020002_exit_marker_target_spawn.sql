alter table public.map_markers
  add column if not exists exit_target_spawn_marker_id uuid references public.map_markers(id) on delete set null;

create index if not exists map_markers_exit_target_spawn_marker_id_idx
  on public.map_markers(exit_target_spawn_marker_id);
