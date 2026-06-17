alter table public.map_markers
  add column if not exists exit_target_type text,
  add column if not exists exit_target_marker_id uuid references public.map_markers(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'map_markers_exit_target_type_check'
  ) then
    alter table public.map_markers
      add constraint map_markers_exit_target_type_check
      check (exit_target_type is null or exit_target_type in ('world_marker', 'mini_map'));
  end if;
end $$;
