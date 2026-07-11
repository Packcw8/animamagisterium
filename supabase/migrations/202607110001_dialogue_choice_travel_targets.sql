alter table public.story_dialogue_choices
  add column if not exists travel_target_type text,
  add column if not exists travel_target_marker_id uuid references public.map_markers(id) on delete set null,
  add column if not exists travel_target_mini_map_id uuid references public.mini_maps(id) on delete set null,
  add column if not exists travel_target_spawn_marker_id uuid references public.map_markers(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'story_dialogue_choices_travel_target_type_check'
  ) then
    alter table public.story_dialogue_choices
      add constraint story_dialogue_choices_travel_target_type_check
      check (travel_target_type is null or travel_target_type in ('world_marker', 'mini_map'));
  end if;
end $$;

alter table public.story_dialogue_choices
  drop constraint if exists story_dialogue_choices_action_check;

alter table public.story_dialogue_choices
  add constraint story_dialogue_choices_action_check
  check (action in ('go_to_node', 'start_battle', 'start_quest', 'complete_event', 'unlock_next_event', 'give_reward', 'end_conversation', 'return_to_map', 'travel_to_marker'));

create index if not exists story_dialogue_choices_travel_target_marker_idx
  on public.story_dialogue_choices(travel_target_marker_id);

create index if not exists story_dialogue_choices_travel_target_mini_map_idx
  on public.story_dialogue_choices(travel_target_mini_map_id);

create index if not exists story_dialogue_choices_travel_target_spawn_marker_idx
  on public.story_dialogue_choices(travel_target_spawn_marker_id);
