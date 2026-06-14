alter table public.map_markers
  add column if not exists linked_route_id uuid references public.map_routes(id) on delete set null,
  add column if not exists starts_route_on_accept boolean not null default false;
