create table if not exists public.player_weekly_distance_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  week_start date not null,
  distance_walked_meters numeric not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (character_id, week_start)
);

create index if not exists player_weekly_distance_stats_week_distance_idx
  on public.player_weekly_distance_stats(week_start, distance_walked_meters desc);

alter table public.player_weekly_distance_stats enable row level security;

grant select, insert, update on public.player_weekly_distance_stats to authenticated;

drop policy if exists "player_weekly_distance_stats_read_all" on public.player_weekly_distance_stats;
create policy "player_weekly_distance_stats_read_all"
  on public.player_weekly_distance_stats for select
  to authenticated
  using (true);

drop policy if exists "player_weekly_distance_stats_owner_insert" on public.player_weekly_distance_stats;
create policy "player_weekly_distance_stats_owner_insert"
  on public.player_weekly_distance_stats for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "player_weekly_distance_stats_owner_update" on public.player_weekly_distance_stats;
create policy "player_weekly_distance_stats_owner_update"
  on public.player_weekly_distance_stats for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.increment_character_distance_walked(
  p_character_id uuid,
  p_meters numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  next_total numeric;
  v_user_id uuid;
  v_week_start date := date_trunc('week', now())::date;
begin
  select user_id
    into v_user_id
    from public.characters
    where id = p_character_id
      and user_id = auth.uid();

  if v_user_id is null then
    return 0;
  end if;

  if p_meters is null or p_meters <= 0 then
    select coalesce(total_distance_walked_meters, 0)
      into next_total
      from public.characters
      where id = p_character_id
        and user_id = auth.uid();

    return coalesce(next_total, 0);
  end if;

  update public.characters
  set total_distance_walked_meters = coalesce(total_distance_walked_meters, 0) + p_meters
  where id = p_character_id
    and user_id = auth.uid()
  returning total_distance_walked_meters into next_total;

  insert into public.player_weekly_distance_stats (
    user_id,
    character_id,
    week_start,
    distance_walked_meters,
    updated_at
  )
  values (
    v_user_id,
    p_character_id,
    v_week_start,
    p_meters,
    now()
  )
  on conflict (character_id, week_start)
  do update set
    distance_walked_meters = public.player_weekly_distance_stats.distance_walked_meters + excluded.distance_walked_meters,
    updated_at = now();

  return coalesce(next_total, 0);
end;
$$;

grant execute on function public.increment_character_distance_walked(uuid, numeric) to authenticated;

alter table public.characters
  add column if not exists portrait_thumb_url text;

drop view if exists public.player_weekly_leaderboards;

create view public.player_weekly_leaderboards as
with current_week as (
  select date_trunc('week', now())::date as week_start
),
training_totals as (
  select
    ts.character_id,
    count(*)::integer as training_sessions_completed
  from public.training_sessions ts
  cross join current_week cw
  where ts.completed_at >= cw.week_start
    and ts.completed_at < cw.week_start + interval '7 days'
  group by ts.character_id
),
event_totals as (
  select
    mec.user_id,
    count(*)::integer as event_completions
  from public.map_event_completions mec
  cross join current_week cw
  where mec.completed_at >= cw.week_start
    and mec.completed_at < cw.week_start + interval '7 days'
  group by mec.user_id
),
enemy_kill_totals as (
  select
    ekl.character_id,
    count(*)::integer as total_enemy_kills
  from public.enemy_kill_log ekl
  cross join current_week cw
  where ekl.killed_at >= cw.week_start
    and ekl.killed_at < cw.week_start + interval '7 days'
  group by ekl.character_id
),
weekly_distance as (
  select
    pwds.character_id,
    sum(pwds.distance_walked_meters)::numeric as total_distance_walked_meters
  from public.player_weekly_distance_stats pwds
  cross join current_week cw
  where pwds.week_start = cw.week_start
  group by pwds.character_id
)
select
  c.id as character_id,
  c.user_id,
  coalesce(p.username, c.name, 'Adventurer') as display_name,
  c.name as character_name,
  c.portrait_url,
  c.portrait_thumb_url,
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
  coalesce(wd.total_distance_walked_meters, 0) as total_distance_walked_meters,
  coalesce(tt.training_sessions_completed, 0) as training_sessions_completed,
  coalesce(et.event_completions, 0) as event_completions,
  coalesce(ekt.total_enemy_kills, 0) as total_enemy_kills,
  cw.week_start
from public.characters c
cross join current_week cw
left join public.profiles p on p.id = c.user_id
left join public.attributes a on a.character_id = c.id
left join weekly_distance wd on wd.character_id = c.id
left join training_totals tt on tt.character_id = c.id
left join event_totals et on et.user_id = c.user_id
left join enemy_kill_totals ekt on ekt.character_id = c.id
where
  coalesce(wd.total_distance_walked_meters, 0) > 0
  or coalesce(tt.training_sessions_completed, 0) > 0
  or coalesce(et.event_completions, 0) > 0
  or coalesce(ekt.total_enemy_kills, 0) > 0;

grant select on public.player_weekly_leaderboards to authenticated;
