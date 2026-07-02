alter table public.map_markers
  add column if not exists linked_route_start_direction text not null default 'forward'
  check (linked_route_start_direction in ('forward', 'reverse'));
