alter table public.map_markers
  add column if not exists signpost_route_scope text not null default 'current_map';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'map_markers_signpost_route_scope_check'
      and conrelid = 'public.map_markers'::regclass
  ) then
    alter table public.map_markers
      add constraint map_markers_signpost_route_scope_check
      check (signpost_route_scope in ('current_map', 'overworld', 'all_chapter'));
  end if;
end $$;

comment on column public.map_markers.signpost_route_scope is
  'Controls which walking paths the admin route picker shows for Sign Post markers. Players only see explicitly linked marker_route_links.';
