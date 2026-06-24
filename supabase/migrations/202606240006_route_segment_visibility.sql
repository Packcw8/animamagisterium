alter table public.map_routes
  add column if not exists path_segments jsonb not null default '[]'::jsonb;
