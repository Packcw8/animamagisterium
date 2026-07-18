alter table public.map_routes
  add column if not exists route_kind text not null default 'story',
  add column if not exists farming_summary text;

alter table public.map_routes
  drop constraint if exists map_routes_route_kind_check;

alter table public.map_routes
  add constraint map_routes_route_kind_check
  check (route_kind in ('story', 'farming', 'travel'));

alter table public.map_events
  add column if not exists repeatable boolean not null default false,
  add column if not exists rarity text not null default 'common';

alter table public.map_events
  drop constraint if exists map_events_rarity_check;

alter table public.map_events
  add constraint map_events_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));

create index if not exists map_routes_route_kind_idx
  on public.map_routes(route_kind, season_number, chapter_number);

create index if not exists map_events_route_random_idx
  on public.map_events(route_id, trigger_mode, repeatable, rarity);
