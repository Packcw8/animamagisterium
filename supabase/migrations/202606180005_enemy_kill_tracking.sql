create table if not exists public.enemy_kill_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  enemy_key text not null,
  enemy_id uuid references public.enemy_definitions(id) on delete set null,
  npc_id uuid references public.npc_definitions(id) on delete set null,
  enemy_name text not null,
  enemy_type text,
  enemy_source text not null default 'enemy',
  route_id uuid references public.map_routes(id) on delete set null,
  map_event_id uuid references public.map_events(id) on delete set null,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  killed_at timestamp default now()
);

create table if not exists public.player_enemy_kill_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  enemy_key text not null,
  enemy_id uuid references public.enemy_definitions(id) on delete set null,
  npc_id uuid references public.npc_definitions(id) on delete set null,
  enemy_name text not null,
  enemy_type text,
  enemy_source text not null default 'enemy',
  kill_count integer not null default 0,
  last_killed_at timestamp default now(),
  unique (character_id, enemy_key)
);

create table if not exists public.player_enemy_type_kill_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  enemy_type text not null,
  kill_count integer not null default 0,
  last_killed_at timestamp default now(),
  unique (character_id, enemy_type)
);

create index if not exists enemy_kill_log_character_idx on public.enemy_kill_log(character_id, killed_at desc);
create index if not exists enemy_kill_log_type_idx on public.enemy_kill_log(character_id, enemy_type);
create index if not exists player_enemy_kill_stats_character_idx on public.player_enemy_kill_stats(character_id, kill_count desc);
create index if not exists player_enemy_type_kill_stats_character_idx on public.player_enemy_type_kill_stats(character_id, kill_count desc);

alter table public.enemy_kill_log enable row level security;
alter table public.player_enemy_kill_stats enable row level security;
alter table public.player_enemy_type_kill_stats enable row level security;

grant select, insert on public.enemy_kill_log to authenticated;
grant select, insert, update on public.player_enemy_kill_stats to authenticated;
grant select, insert, update on public.player_enemy_type_kill_stats to authenticated;

drop policy if exists "enemy_kill_log_owner_read" on public.enemy_kill_log;
drop policy if exists "enemy_kill_log_owner_insert" on public.enemy_kill_log;
drop policy if exists "player_enemy_kill_stats_owner_read" on public.player_enemy_kill_stats;
drop policy if exists "player_enemy_kill_stats_owner_insert" on public.player_enemy_kill_stats;
drop policy if exists "player_enemy_kill_stats_owner_update" on public.player_enemy_kill_stats;
drop policy if exists "player_enemy_type_kill_stats_owner_read" on public.player_enemy_type_kill_stats;
drop policy if exists "player_enemy_type_kill_stats_owner_insert" on public.player_enemy_type_kill_stats;
drop policy if exists "player_enemy_type_kill_stats_owner_update" on public.player_enemy_type_kill_stats;

create policy "enemy_kill_log_owner_read"
  on public.enemy_kill_log for select
  to authenticated
  using (user_id = auth.uid());

create policy "enemy_kill_log_owner_insert"
  on public.enemy_kill_log for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "player_enemy_kill_stats_owner_read"
  on public.player_enemy_kill_stats for select
  to authenticated
  using (user_id = auth.uid());

create policy "player_enemy_kill_stats_owner_insert"
  on public.player_enemy_kill_stats for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "player_enemy_kill_stats_owner_update"
  on public.player_enemy_kill_stats for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "player_enemy_type_kill_stats_owner_read"
  on public.player_enemy_type_kill_stats for select
  to authenticated
  using (user_id = auth.uid());

create policy "player_enemy_type_kill_stats_owner_insert"
  on public.player_enemy_type_kill_stats for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "player_enemy_type_kill_stats_owner_update"
  on public.player_enemy_type_kill_stats for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace view public.player_leaderboards as
with route_totals as (
  select
    user_id,
    sum(distance_walked_meters)::numeric as total_distance_walked_meters
  from public.route_progress
  group by user_id
),
training_totals as (
  select
    character_id,
    count(*)::integer as training_sessions_completed
  from public.training_sessions
  group by character_id
),
event_totals as (
  select
    user_id,
    count(*)::integer as event_completions
  from public.map_event_completions
  group by user_id
),
enemy_kill_totals as (
  select
    character_id,
    sum(kill_count)::integer as total_enemy_kills
  from public.player_enemy_kill_stats
  group by character_id
)
select
  c.id as character_id,
  c.user_id,
  coalesce(p.username, c.name, 'Adventurer') as display_name,
  c.name as character_name,
  c.portrait_url,
  c.level,
  c.xp,
  c.gold,
  coalesce(a.strength, 0) as strength,
  coalesce(a.endurance, 0) as endurance,
  coalesce(a.agility, 0) as agility,
  coalesce(a.intelligence, 0) as intelligence,
  coalesce(a.wisdom, 0) as wisdom,
  coalesce(a.charisma, 0) as charisma,
  coalesce(a.spirit, 0) as spirit,
  (
    coalesce(a.strength, 0) +
    coalesce(a.endurance, 0) +
    coalesce(a.agility, 0) +
    coalesce(a.intelligence, 0) +
    coalesce(a.wisdom, 0) +
    coalesce(a.charisma, 0) +
    coalesce(a.spirit, 0)
  ) as attribute_total,
  coalesce(rt.total_distance_walked_meters, 0) as total_distance_walked_meters,
  coalesce(tt.training_sessions_completed, 0) as training_sessions_completed,
  coalesce(et.event_completions, 0) as event_completions,
  coalesce(ekt.total_enemy_kills, 0) as total_enemy_kills
from public.characters c
left join public.profiles p on p.id = c.user_id
left join public.attributes a on a.character_id = c.id
left join route_totals rt on rt.user_id = c.user_id
left join training_totals tt on tt.character_id = c.id
left join event_totals et on et.user_id = c.user_id
left join enemy_kill_totals ekt on ekt.character_id = c.id;

grant select on public.player_leaderboards to authenticated;
