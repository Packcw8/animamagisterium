alter table public.map_routes
  add column if not exists content_scope text not null default 'chapter',
  add column if not exists preserve_player_chapter boolean not null default false;

alter table public.map_routes
  drop constraint if exists map_routes_content_scope_check;

alter table public.map_routes
  add constraint map_routes_content_scope_check
  check (content_scope in ('chapter', 'universal'));

update public.map_routes
set
  content_scope = 'universal',
  preserve_player_chapter = true,
  updated_at = now()
where route_kind in ('farming', 'travel');

create index if not exists map_routes_scope_kind_idx
  on public.map_routes(content_scope, route_kind, season_number, chapter_number);
