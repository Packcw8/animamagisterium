alter table public.story_dialogue_choices
  add column if not exists check_enabled boolean not null default false,
  add column if not exists check_attribute text
    check (check_attribute in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')),
  add column if not exists check_dc integer not null default 10,
  add column if not exists check_success_node_id uuid references public.story_dialogue_nodes(id) on delete set null,
  add column if not exists check_failure_node_id uuid references public.story_dialogue_nodes(id) on delete set null,
  add column if not exists check_success_text text,
  add column if not exists check_failure_text text;

create table if not exists public.player_attribute_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  dialogue_node_id uuid references public.story_dialogue_nodes(id) on delete set null,
  choice_id uuid not null references public.story_dialogue_choices(id) on delete cascade,
  attribute_used text not null
    check (attribute_used in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')),
  attribute_value integer not null default 0,
  dc integer not null default 10,
  roll_value integer not null,
  final_result integer not null,
  succeeded boolean not null,
  created_at timestamp default now()
);

alter table public.player_attribute_checks enable row level security;

grant select, insert on public.player_attribute_checks to authenticated;

drop policy if exists "player_attribute_checks_select_own" on public.player_attribute_checks;
drop policy if exists "player_attribute_checks_insert_own" on public.player_attribute_checks;

create policy "player_attribute_checks_select_own"
  on public.player_attribute_checks for select
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_attribute_checks_insert_own"
  on public.player_attribute_checks for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_map_admin());
