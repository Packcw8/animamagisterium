alter table public.story_dialogue_nodes
  add column if not exists marker_id uuid references public.map_markers(id) on delete cascade;

alter table public.story_dialogue_nodes
  alter column event_id drop not null;

alter table public.story_dialogue_nodes
  drop constraint if exists story_dialogue_nodes_source_check;

alter table public.story_dialogue_nodes
  add constraint story_dialogue_nodes_source_check
  check (
    (event_id is not null and marker_id is null)
    or
    (event_id is null and marker_id is not null)
  );

create index if not exists story_dialogue_nodes_marker_id_idx
  on public.story_dialogue_nodes(marker_id);

alter table public.story_dialogue_choices
  drop constraint if exists story_dialogue_choices_action_check;

alter table public.story_dialogue_choices
  add constraint story_dialogue_choices_action_check
  check (action in (
    'go_to_node',
    'start_battle',
    'start_quest',
    'complete_event',
    'unlock_next_event',
    'give_reward',
    'end_conversation',
    'return_to_map'
  ));

drop policy if exists "story_dialogue_nodes_read" on public.story_dialogue_nodes;

create policy "story_dialogue_nodes_read"
  on public.story_dialogue_nodes for select
  to authenticated
  using (
    public.is_map_admin()
    or exists (
      select 1 from public.map_events
      where map_events.id = story_dialogue_nodes.event_id
        and map_events.is_active = true
    )
    or exists (
      select 1 from public.map_markers
      where map_markers.id = story_dialogue_nodes.marker_id
        and map_markers.is_active = true
    )
  );

drop policy if exists "story_dialogue_choices_read" on public.story_dialogue_choices;

create policy "story_dialogue_choices_read"
  on public.story_dialogue_choices for select
  to authenticated
  using (
    public.is_map_admin()
    or exists (
      select 1
      from public.story_dialogue_nodes
      left join public.map_events on map_events.id = story_dialogue_nodes.event_id
      left join public.map_markers on map_markers.id = story_dialogue_nodes.marker_id
      where story_dialogue_nodes.id = story_dialogue_choices.node_id
        and (
          map_events.is_active = true
          or map_markers.is_active = true
        )
    )
  );
