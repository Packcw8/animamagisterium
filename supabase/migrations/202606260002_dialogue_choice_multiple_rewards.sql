create table if not exists public.dialogue_choice_rewards (
  id uuid primary key default gen_random_uuid(),
  choice_id uuid not null references public.story_dialogue_choices(id) on delete cascade,
  reward_type text not null default 'item' check (reward_type in ('gold', 'xp', 'item')),
  item_id uuid references public.item_definitions(id) on delete set null,
  quantity integer not null default 1,
  amount integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index if not exists dialogue_choice_rewards_choice_idx
  on public.dialogue_choice_rewards(choice_id, sort_order);

alter table public.dialogue_choice_rewards enable row level security;

grant select, insert, update, delete on public.dialogue_choice_rewards to authenticated;

drop policy if exists "dialogue_choice_rewards_read" on public.dialogue_choice_rewards;
drop policy if exists "dialogue_choice_rewards_admin_insert" on public.dialogue_choice_rewards;
drop policy if exists "dialogue_choice_rewards_admin_update" on public.dialogue_choice_rewards;
drop policy if exists "dialogue_choice_rewards_admin_delete" on public.dialogue_choice_rewards;

create policy "dialogue_choice_rewards_read"
  on public.dialogue_choice_rewards for select
  to authenticated
  using (
    public.is_map_admin()
    or exists (
      select 1
      from public.story_dialogue_choices
      join public.story_dialogue_nodes on story_dialogue_nodes.id = story_dialogue_choices.node_id
      left join public.map_events on map_events.id = story_dialogue_nodes.event_id
      left join public.map_markers on map_markers.id = story_dialogue_nodes.marker_id
      where story_dialogue_choices.id = dialogue_choice_rewards.choice_id
        and (
          map_events.is_active = true
          or map_markers.is_active = true
        )
    )
  );

create policy "dialogue_choice_rewards_admin_insert"
  on public.dialogue_choice_rewards for insert
  to authenticated
  with check (public.is_map_admin());

create policy "dialogue_choice_rewards_admin_update"
  on public.dialogue_choice_rewards for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "dialogue_choice_rewards_admin_delete"
  on public.dialogue_choice_rewards for delete
  to authenticated
  using (public.is_map_admin());
