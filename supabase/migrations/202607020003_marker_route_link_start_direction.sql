alter table public.marker_route_links
  add column if not exists start_direction text not null default 'forward'
  check (start_direction in ('forward', 'reverse'));
