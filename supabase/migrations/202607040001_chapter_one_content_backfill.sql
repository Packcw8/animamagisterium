insert into public.map_seasons (season_number, name, description)
values (1, 'Season 1', 'Opening season')
on conflict (season_number) do update
set name = coalesce(public.map_seasons.name, excluded.name),
    description = coalesce(public.map_seasons.description, excluded.description),
    updated_at = now();

insert into public.map_chapters (season_number, chapter_number, name, description)
values (1, 1, 'Chapter 1', 'Opening chapter')
on conflict (season_number, chapter_number) do update
set name = coalesce(public.map_chapters.name, excluded.name),
    description = coalesce(public.map_chapters.description, excluded.description),
    updated_at = now();

-- Pass 1: all content that already exists before chapters/subscriptions is Chapter 1.
update public.map_routes set season_number = 1, chapter_number = 1;
update public.map_markers set season_number = 1, chapter_number = 1;
update public.mini_maps set season_number = 1, chapter_number = 1;
update public.map_events set season_number = 1, chapter_number = 1;
update public.tutorial_steps set season_number = 1, chapter_number = 1;
update public.marker_legend_items set season_number = 1, chapter_number = 1;
update public.marker_route_links set season_number = 1, chapter_number = 1;
update public.marker_market_items set season_number = 1, chapter_number = 1;
update public.world_map_settings set season_number = 1, chapter_number = 1;
update public.item_definitions set season_number = 1, chapter_number = 1;
update public.combat_abilities set season_number = 1, chapter_number = 1;
update public.enemy_definitions set season_number = 1, chapter_number = 1;
update public.npc_definitions set season_number = 1, chapter_number = 1;

create index if not exists map_routes_season_chapter_idx
  on public.map_routes(season_number, chapter_number, mini_map_id, sort_order);

create index if not exists map_markers_season_chapter_idx
  on public.map_markers(season_number, chapter_number, mini_map_id, type, title);

create index if not exists mini_maps_season_chapter_idx
  on public.mini_maps(season_number, chapter_number, type, name);

create index if not exists map_events_season_chapter_idx
  on public.map_events(season_number, chapter_number, route_id, distance_marker_percent);
