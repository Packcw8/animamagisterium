alter table public.story_dialogue_choices
  add column if not exists consume_required_item boolean not null default false;

