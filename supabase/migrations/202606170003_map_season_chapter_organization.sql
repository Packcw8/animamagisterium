alter table public.map_routes
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.map_markers
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.mini_maps
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.map_events
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.tutorial_steps
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.marker_legend_items
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.marker_route_links
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

alter table public.marker_market_items
  add column if not exists season_number integer not null default 1,
  add column if not exists chapter_number integer not null default 1;

update public.map_routes set season_number = 1, chapter_number = 1 where season_number is null or chapter_number is null;
update public.map_markers set season_number = 1, chapter_number = 1 where season_number is null or chapter_number is null;
update public.mini_maps set season_number = 1, chapter_number = 1 where season_number is null or chapter_number is null;
update public.map_events set season_number = 1, chapter_number = 1 where season_number is null or chapter_number is null;
update public.tutorial_steps set season_number = 1, chapter_number = 1 where season_number is null or chapter_number is null;
update public.marker_legend_items set season_number = 1, chapter_number = 1 where season_number is null or chapter_number is null;
update public.marker_route_links set season_number = 1, chapter_number = 1 where season_number is null or chapter_number is null;
update public.marker_market_items set season_number = 1, chapter_number = 1 where season_number is null or chapter_number is null;
