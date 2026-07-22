alter table public.crafting_recipes
  add column if not exists content_scope text not null default 'chapter',
  add column if not exists category text,
  add column if not exists sort_order integer not null default 0;

alter table public.crafting_recipes
  drop constraint if exists crafting_recipes_content_scope_check;

alter table public.crafting_recipes
  add constraint crafting_recipes_content_scope_check
  check (content_scope in ('chapter', 'universal'));

update public.crafting_recipes
set
  content_scope = 'universal',
  updated_at = now()
where station_type is null
  and category is null
  and name ilike 'Smelt % Bar';

create index if not exists crafting_recipes_scope_station_idx
  on public.crafting_recipes (content_scope, season_number, chapter_number, station_type, category, sort_order);
