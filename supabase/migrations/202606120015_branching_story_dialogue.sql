create table if not exists public.story_dialogue_nodes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.map_events(id) on delete cascade,
  node_key text not null default '',
  title text not null,
  npc_name text,
  npc_portrait_url text,
  background_image_url text,
  dialogue_text text not null default '',
  is_start boolean not null default false,
  is_ending boolean not null default false,
  allow_end_chat boolean not null default true,
  end_completes_event boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.story_dialogue_choices (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.story_dialogue_nodes(id) on delete cascade,
  button_text text not null,
  player_dialogue_text text,
  action text not null default 'go_to_node' check (action in ('go_to_node', 'start_battle', 'complete_event', 'give_reward', 'end_conversation', 'return_to_map')),
  next_node_id uuid references public.story_dialogue_nodes(id) on delete set null,
  battle_event_id uuid references public.map_events(id) on delete set null,
  reward_xp integer not null default 0,
  reward_item text,
  sort_order integer not null default 0,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.story_dialogue_nodes enable row level security;
alter table public.story_dialogue_choices enable row level security;

grant select, insert, update, delete on public.story_dialogue_nodes to authenticated;
grant select, insert, update, delete on public.story_dialogue_choices to authenticated;

drop policy if exists "story_dialogue_nodes_read" on public.story_dialogue_nodes;
drop policy if exists "story_dialogue_nodes_admin_insert" on public.story_dialogue_nodes;
drop policy if exists "story_dialogue_nodes_admin_update" on public.story_dialogue_nodes;
drop policy if exists "story_dialogue_nodes_admin_delete" on public.story_dialogue_nodes;

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
  );

create policy "story_dialogue_nodes_admin_insert"
  on public.story_dialogue_nodes for insert
  to authenticated
  with check (public.is_map_admin());

create policy "story_dialogue_nodes_admin_update"
  on public.story_dialogue_nodes for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "story_dialogue_nodes_admin_delete"
  on public.story_dialogue_nodes for delete
  to authenticated
  using (public.is_map_admin());

drop policy if exists "story_dialogue_choices_read" on public.story_dialogue_choices;
drop policy if exists "story_dialogue_choices_admin_insert" on public.story_dialogue_choices;
drop policy if exists "story_dialogue_choices_admin_update" on public.story_dialogue_choices;
drop policy if exists "story_dialogue_choices_admin_delete" on public.story_dialogue_choices;

create policy "story_dialogue_choices_read"
  on public.story_dialogue_choices for select
  to authenticated
  using (
    public.is_map_admin()
    or exists (
      select 1
      from public.story_dialogue_nodes
      join public.map_events on map_events.id = story_dialogue_nodes.event_id
      where story_dialogue_nodes.id = story_dialogue_choices.node_id
        and map_events.is_active = true
    )
  );

create policy "story_dialogue_choices_admin_insert"
  on public.story_dialogue_choices for insert
  to authenticated
  with check (public.is_map_admin());

create policy "story_dialogue_choices_admin_update"
  on public.story_dialogue_choices for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "story_dialogue_choices_admin_delete"
  on public.story_dialogue_choices for delete
  to authenticated
  using (public.is_map_admin());
