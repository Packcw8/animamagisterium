alter table public.story_dialogue_choices
  add column if not exists choice_group_key text,
  add column if not exists choice_group_lock_message text,
  add column if not exists hide_when_group_locked boolean not null default false,
  add column if not exists set_story_flag_key text,
  add column if not exists set_story_flag_value boolean not null default true;

create index if not exists story_dialogue_choices_group_key_idx
  on public.story_dialogue_choices(choice_group_key)
  where choice_group_key is not null;

create index if not exists story_dialogue_choices_set_story_flag_idx
  on public.story_dialogue_choices(set_story_flag_key)
  where set_story_flag_key is not null;
