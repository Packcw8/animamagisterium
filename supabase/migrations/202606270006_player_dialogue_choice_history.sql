alter table public.story_dialogue_choices
  add column if not exists repeatable boolean not null default true,
  add column if not exists hide_after_selected boolean not null default false,
  add column if not exists disable_after_selected boolean not null default false,
  add column if not exists selected_message text;

create table if not exists public.player_dialogue_choice_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  choice_id uuid not null references public.story_dialogue_choices(id) on delete cascade,
  node_id uuid references public.story_dialogue_nodes(id) on delete set null,
  event_id uuid references public.map_events(id) on delete set null,
  marker_id uuid references public.map_markers(id) on delete set null,
  selected_at timestamp default now(),
  unique (user_id, choice_id)
);

alter table public.player_dialogue_choice_history enable row level security;

grant select, insert, delete on public.player_dialogue_choice_history to authenticated;

drop policy if exists "player_dialogue_choice_history_read" on public.player_dialogue_choice_history;
drop policy if exists "player_dialogue_choice_history_insert" on public.player_dialogue_choice_history;
drop policy if exists "player_dialogue_choice_history_delete" on public.player_dialogue_choice_history;

create policy "player_dialogue_choice_history_read"
  on public.player_dialogue_choice_history for select
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_dialogue_choice_history_insert"
  on public.player_dialogue_choice_history for insert
  with check (auth.uid() = user_id);

create policy "player_dialogue_choice_history_delete"
  on public.player_dialogue_choice_history for delete
  using (auth.uid() = user_id or public.is_map_admin());

create index if not exists player_dialogue_choice_history_user_idx
  on public.player_dialogue_choice_history(user_id);

create index if not exists player_dialogue_choice_history_choice_idx
  on public.player_dialogue_choice_history(choice_id);
