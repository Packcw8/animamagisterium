alter table public.map_markers
  add column if not exists content_scope text not null default 'chapter';

alter table public.map_markers
  drop constraint if exists map_markers_content_scope_check;

alter table public.map_markers
  add constraint map_markers_content_scope_check
  check (content_scope in ('chapter', 'universal'));

update public.map_markers
set
  content_scope = coalesce(nullif(content_scope, ''), 'chapter'),
  season_number = coalesce(season_number, 1),
  chapter_number = coalesce(chapter_number, 1);

create index if not exists map_markers_content_scope_chapter_idx
  on public.map_markers(content_scope, season_number, chapter_number);

create index if not exists map_markers_mini_map_scope_chapter_idx
  on public.map_markers(mini_map_id, content_scope, season_number, chapter_number);
