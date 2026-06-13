alter table public.story_dialogue_choices
  drop constraint if exists story_dialogue_choices_action_check;

alter table public.story_dialogue_choices
  add constraint story_dialogue_choices_action_check
  check (action in ('go_to_node', 'start_battle', 'complete_event', 'unlock_next_event', 'give_reward', 'end_conversation', 'return_to_map'));
