alter table public.mini_maps
  add column if not exists area_key text,
  add column if not exists area_name text,
  add column if not exists sort_order integer not null default 0;

update public.mini_maps
set
  area_key = coalesce(
    nullif(area_key, ''),
    lower(regexp_replace(coalesce(type, 'area'), '[^a-zA-Z0-9]+', '-', 'g'))
  ),
  area_name = coalesce(
    nullif(area_name, ''),
    initcap(replace(coalesce(type, 'area'), '-', ' '))
  )
where area_key is null
   or area_key = ''
   or area_name is null
   or area_name = '';

create index if not exists mini_maps_area_key_idx
  on public.mini_maps(area_key);

create index if not exists mini_maps_area_sort_idx
  on public.mini_maps(season_number, chapter_number, area_key, sort_order, name);
