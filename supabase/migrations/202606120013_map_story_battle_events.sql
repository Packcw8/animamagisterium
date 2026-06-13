create table if not exists public.map_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('story', 'battle')),
  title text not null,
  route_id uuid references public.map_routes(id) on delete cascade,
  distance_marker_percent numeric not null default 0 check (distance_marker_percent >= 0 and distance_marker_percent <= 100),
  background_image_url text,
  npc_name text,
  npc_portrait_url text,
  dialogue_text text,
  choices jsonb not null default '[]'::jsonb,
  enemy_name text,
  enemy_image_url text,
  enemy_hp integer not null default 30,
  enemy_attack_damage integer not null default 5,
  battle_intro_text text,
  victory_text text,
  defeat_text text,
  reward_xp integer not null default 0,
  reward_item text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.map_event_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.map_events(id) on delete cascade,
  completed_at timestamp default now(),
  unique (user_id, event_id)
);

alter table public.map_events enable row level security;
alter table public.map_event_completions enable row level security;

grant select, insert, update, delete on public.map_events to authenticated;
grant select, insert, update, delete on public.map_event_completions to authenticated;

drop policy if exists "map_events_player_read" on public.map_events;
drop policy if exists "map_events_admin_insert" on public.map_events;
drop policy if exists "map_events_admin_update" on public.map_events;
drop policy if exists "map_events_admin_delete" on public.map_events;

create policy "map_events_player_read"
  on public.map_events
  for select
  to authenticated
  using (is_active = true or public.is_map_admin());

create policy "map_events_admin_insert"
  on public.map_events
  for insert
  to authenticated
  with check (public.is_map_admin());

create policy "map_events_admin_update"
  on public.map_events
  for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "map_events_admin_delete"
  on public.map_events
  for delete
  to authenticated
  using (public.is_map_admin());

drop policy if exists "map_event_completions_owner_read" on public.map_event_completions;
drop policy if exists "map_event_completions_owner_insert" on public.map_event_completions;
drop policy if exists "map_event_completions_owner_delete" on public.map_event_completions;

create policy "map_event_completions_owner_read"
  on public.map_event_completions
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_map_admin());

create policy "map_event_completions_owner_insert"
  on public.map_event_completions
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "map_event_completions_owner_delete"
  on public.map_event_completions
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_map_admin());
