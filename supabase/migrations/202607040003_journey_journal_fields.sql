alter table public.map_routes
  add column if not exists journal_title text,
  add column if not exists journal_body text,
  add column if not exists journal_image_url text,
  add column if not exists journal_sort_order integer not null default 0;

alter table public.map_markers
  add column if not exists journal_title text,
  add column if not exists journal_body text,
  add column if not exists journal_image_url text,
  add column if not exists journal_sort_order integer not null default 0;

update public.map_routes
set
  journal_title = coalesce(journal_title, name),
  journal_sort_order = coalesce(nullif(journal_sort_order, 0), sort_order)
where journal_title is null
   or journal_sort_order = 0;

update public.map_markers
set
  journal_title = coalesce(journal_title, title),
  journal_sort_order = coalesce(nullif(journal_sort_order, 0), story_order)
where journal_title is null
   or journal_sort_order = 0;

create index if not exists map_routes_journal_scope_idx
  on public.map_routes(season_number, chapter_number, journal_sort_order, sort_order);

create index if not exists map_markers_journal_scope_idx
  on public.map_markers(season_number, chapter_number, journal_sort_order, story_order);

