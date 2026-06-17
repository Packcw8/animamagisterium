alter table public.map_markers
  add column if not exists reward_timing text not null default 'on_interact';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'map_markers_reward_timing_check'
  ) then
    alter table public.map_markers
      add constraint map_markers_reward_timing_check
      check (reward_timing in ('on_interact', 'on_path_complete'));
  end if;
end $$;

alter table public.route_progress
  add column if not exists source_marker_id uuid references public.map_markers(id) on delete set null;
