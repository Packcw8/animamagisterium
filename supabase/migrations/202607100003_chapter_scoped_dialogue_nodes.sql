alter table public.story_dialogue_nodes
  add column if not exists content_scope text not null default 'chapter',
  add column if not exists season_number integer,
  add column if not exists chapter_number integer;

alter table public.story_dialogue_nodes
  drop constraint if exists story_dialogue_nodes_content_scope_check;

alter table public.story_dialogue_nodes
  add constraint story_dialogue_nodes_content_scope_check
  check (content_scope in ('chapter', 'universal'));

update public.story_dialogue_nodes as node
set
  content_scope = coalesce(nullif(node.content_scope, ''), 'chapter'),
  season_number = coalesce(node.season_number, event.season_number, marker.season_number, 1),
  chapter_number = coalesce(node.chapter_number, event.chapter_number, marker.chapter_number, 1)
from public.story_dialogue_nodes as source
left join public.map_events as event on event.id = source.event_id
left join public.map_markers as marker on marker.id = source.marker_id
where node.id = source.id
  and coalesce(nullif(node.content_scope, ''), 'chapter') = 'chapter';

update public.story_dialogue_nodes
set
  season_number = null,
  chapter_number = null
where content_scope = 'universal';

create index if not exists story_dialogue_nodes_event_chapter_idx
  on public.story_dialogue_nodes(event_id, content_scope, season_number, chapter_number);

create index if not exists story_dialogue_nodes_marker_chapter_idx
  on public.story_dialogue_nodes(marker_id, content_scope, season_number, chapter_number);
