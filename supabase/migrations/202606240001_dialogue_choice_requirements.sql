alter table public.story_dialogue_choices
  add column if not exists requirement_type text not null default 'none'
    check (requirement_type in ('none', 'gold', 'item', 'story_flag', 'completed_marker', 'completed_event', 'tutorial_step', 'ability_known', 'attribute_level')),
  add column if not exists requirement_value text,
  add column if not exists requirement_quantity integer not null default 1,
  add column if not exists requirement_operator text not null default '>='
    check (requirement_operator in ('>=', '>', '=', '<=', '<')),
  add column if not exists hide_if_unmet boolean not null default false,
  add column if not exists disable_if_unmet boolean not null default true,
  add column if not exists requirement_failure_message text;

create table if not exists public.player_story_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  flag_key text not null,
  flag_value boolean not null default true,
  text_value text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (character_id, flag_key)
);

create table if not exists public.player_tutorial_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  tutorial_step_id uuid not null references public.tutorial_steps(id) on delete cascade,
  completed_at timestamp default now(),
  unique (character_id, tutorial_step_id)
);

alter table public.player_story_flags enable row level security;
alter table public.player_tutorial_completions enable row level security;

grant select, insert, update, delete on public.player_story_flags to authenticated;
grant select, insert, update, delete on public.player_tutorial_completions to authenticated;

drop policy if exists "player_story_flags_select_own" on public.player_story_flags;
drop policy if exists "player_story_flags_insert_own" on public.player_story_flags;
drop policy if exists "player_story_flags_update_own" on public.player_story_flags;
drop policy if exists "player_story_flags_delete_own" on public.player_story_flags;

create policy "player_story_flags_select_own"
  on public.player_story_flags for select
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_story_flags_insert_own"
  on public.player_story_flags for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_story_flags_update_own"
  on public.player_story_flags for update
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_story_flags_delete_own"
  on public.player_story_flags for delete
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin());

drop policy if exists "player_tutorial_completions_select_own" on public.player_tutorial_completions;
drop policy if exists "player_tutorial_completions_insert_own" on public.player_tutorial_completions;
drop policy if exists "player_tutorial_completions_update_own" on public.player_tutorial_completions;
drop policy if exists "player_tutorial_completions_delete_own" on public.player_tutorial_completions;

create policy "player_tutorial_completions_select_own"
  on public.player_tutorial_completions for select
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_tutorial_completions_insert_own"
  on public.player_tutorial_completions for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_tutorial_completions_update_own"
  on public.player_tutorial_completions for update
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_tutorial_completions_delete_own"
  on public.player_tutorial_completions for delete
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin());
