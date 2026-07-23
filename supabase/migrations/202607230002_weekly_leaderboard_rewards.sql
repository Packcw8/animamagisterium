create table if not exists public.weekly_leaderboard_settings (
  id boolean primary key default true,
  week_starts_on integer not null default 1 check (week_starts_on >= 0 and week_starts_on <= 6),
  updated_at timestamp with time zone default now(),
  constraint weekly_leaderboard_settings_singleton check (id = true)
);

insert into public.weekly_leaderboard_settings (id, week_starts_on)
values (true, 1)
on conflict (id) do nothing;

create table if not exists public.weekly_leaderboard_rewards (
  id uuid primary key default gen_random_uuid(),
  metric text not null check (metric in ('total_distance_walked_meters', 'training_sessions_completed', 'event_completions', 'total_enemy_kills', 'trophies')),
  rank integer not null check (rank between 1 and 3),
  title text not null default '',
  reward_xp integer not null default 0,
  reward_gold integer not null default 0,
  reward_item_id uuid references public.item_definitions(id) on delete set null,
  reward_item_quantity integer not null default 1,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (metric, rank)
);

create table if not exists public.weekly_leaderboard_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  metric text not null,
  rank integer not null,
  score numeric not null default 0,
  week_start date not null,
  week_end date not null,
  reward_id uuid references public.weekly_leaderboard_rewards(id) on delete set null,
  reward_xp integer not null default 0,
  reward_gold integer not null default 0,
  reward_item_id uuid references public.item_definitions(id) on delete set null,
  reward_item_quantity integer not null default 1,
  claimed_at timestamp with time zone default now(),
  unique (character_id, metric, week_start)
);

create index if not exists weekly_leaderboard_reward_claims_week_idx
  on public.weekly_leaderboard_reward_claims(metric, week_start, rank);

alter table public.weekly_leaderboard_settings enable row level security;
alter table public.weekly_leaderboard_rewards enable row level security;
alter table public.weekly_leaderboard_reward_claims enable row level security;

grant select, insert, update, delete on public.weekly_leaderboard_settings to authenticated;
grant select, insert, update, delete on public.weekly_leaderboard_rewards to authenticated;
grant select, insert on public.weekly_leaderboard_reward_claims to authenticated;

drop policy if exists "weekly_leaderboard_settings_read" on public.weekly_leaderboard_settings;
create policy "weekly_leaderboard_settings_read"
  on public.weekly_leaderboard_settings for select
  to authenticated
  using (true);

drop policy if exists "weekly_leaderboard_settings_admin_write" on public.weekly_leaderboard_settings;
create policy "weekly_leaderboard_settings_admin_write"
  on public.weekly_leaderboard_settings for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator')));

drop policy if exists "weekly_leaderboard_rewards_read" on public.weekly_leaderboard_rewards;
create policy "weekly_leaderboard_rewards_read"
  on public.weekly_leaderboard_rewards for select
  to authenticated
  using (true);

drop policy if exists "weekly_leaderboard_rewards_admin_write" on public.weekly_leaderboard_rewards;
create policy "weekly_leaderboard_rewards_admin_write"
  on public.weekly_leaderboard_rewards for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator')));

drop policy if exists "weekly_leaderboard_reward_claims_read" on public.weekly_leaderboard_reward_claims;
create policy "weekly_leaderboard_reward_claims_read"
  on public.weekly_leaderboard_reward_claims for select
  to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator')));

drop policy if exists "weekly_leaderboard_reward_claims_insert_own" on public.weekly_leaderboard_reward_claims;
create policy "weekly_leaderboard_reward_claims_insert_own"
  on public.weekly_leaderboard_reward_claims for insert
  to authenticated
  with check (user_id = auth.uid());

create or replace function public.get_week_start_for_date(p_date date)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (
    p_date - (((extract(dow from p_date)::integer - coalesce((select week_starts_on from public.weekly_leaderboard_settings where id = true), 1) + 7) % 7))::integer
  )::date;
$$;

grant execute on function public.get_week_start_for_date(date) to authenticated;

create or replace view public.player_weekly_leaderboards as
with current_week as (
  select public.get_week_start_for_date(current_date) as week_start
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

create or replace function public.claim_weekly_leaderboard_reward(
  p_character_id uuid,
  p_metric text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_week_start date := public.get_week_start_for_date(current_date) - 7;
  v_week_end date := public.get_week_start_for_date(current_date);
  v_rank integer;
  v_score numeric;
  v_reward public.weekly_leaderboard_rewards%rowtype;
  v_claim public.weekly_leaderboard_reward_claims%rowtype;
begin
  if p_metric not in ('total_distance_walked_meters', 'training_sessions_completed', 'event_completions', 'total_enemy_kills', 'trophies') then
    raise exception 'Unsupported weekly leaderboard metric: %', p_metric;
  end if;

  select user_id
    into v_user_id
    from public.characters
    where id = p_character_id
      and user_id = auth.uid();

  if v_user_id is null then
    raise exception 'Character not found for current user.';
  end if;

  if p_metric = 'trophies' then
    with ranked as (
      select
        character_id,
        trophy_score::numeric as score,
        row_number() over (order by trophy_score desc, created_at asc, id asc) as rank
      from public.player_trophy_harvests
      where created_at >= v_week_start
        and created_at < v_week_end
    )
    select rank, score into v_rank, v_score
    from ranked
    where character_id = p_character_id
    order by rank
    limit 1;
  elsif p_metric = 'total_distance_walked_meters' then
    with ranked as (
      select
        character_id,
        sum(distance_walked_meters)::numeric as score,
        row_number() over (order by sum(distance_walked_meters) desc, min(updated_at) asc, character_id asc) as rank
      from public.player_weekly_distance_stats
      where week_start = v_week_start
      group by character_id
    )
    select rank, score into v_rank, v_score
    from ranked
    where character_id = p_character_id;
  elsif p_metric = 'training_sessions_completed' then
    with ranked as (
      select
        character_id,
        count(*)::numeric as score,
        row_number() over (order by count(*) desc, min(completed_at) asc, character_id asc) as rank
      from public.training_sessions
      where completed_at >= v_week_start
        and completed_at < v_week_end
      group by character_id
    )
    select rank, score into v_rank, v_score
    from ranked
    where character_id = p_character_id;
  elsif p_metric = 'event_completions' then
    with ranked as (
      select
        c.id as character_id,
        count(*)::numeric as score,
        row_number() over (order by count(*) desc, min(mec.completed_at) asc, c.id asc) as rank
      from public.map_event_completions mec
      join public.characters c on c.user_id = mec.user_id
      where mec.completed_at >= v_week_start
        and mec.completed_at < v_week_end
      group by c.id
    )
    select rank, score into v_rank, v_score
    from ranked
    where character_id = p_character_id;
  elsif p_metric = 'total_enemy_kills' then
    with ranked as (
      select
        character_id,
        count(*)::numeric as score,
        row_number() over (order by count(*) desc, min(killed_at) asc, character_id asc) as rank
      from public.enemy_kill_log
      where killed_at >= v_week_start
        and killed_at < v_week_end
      group by character_id
    )
    select rank, score into v_rank, v_score
    from ranked
    where character_id = p_character_id;
  end if;

  if v_rank is null or v_rank > 3 then
    return jsonb_build_object(
      'claimed', false,
      'eligible', false,
      'message', 'No top 3 weekly reward is available for this metric.',
      'week_start', v_week_start,
      'week_end', v_week_end
    );
  end if;

  select *
    into v_reward
    from public.weekly_leaderboard_rewards
    where metric = p_metric
      and rank = v_rank
      and is_active = true;

  if v_reward.id is null then
    return jsonb_build_object(
      'claimed', false,
      'eligible', true,
      'rank', v_rank,
      'score', v_score,
      'message', 'You placed in the top 3, but no reward is configured for this rank yet.',
      'week_start', v_week_start,
      'week_end', v_week_end
    );
  end if;

  select *
    into v_claim
    from public.weekly_leaderboard_reward_claims
    where character_id = p_character_id
      and metric = p_metric
      and week_start = v_week_start;

  if v_claim.id is not null then
    return jsonb_build_object(
      'claimed', false,
      'eligible', true,
      'already_claimed', true,
      'rank', v_claim.rank,
      'score', v_claim.score,
      'message', 'This weekly reward has already been claimed.',
      'week_start', v_week_start,
      'week_end', v_week_end
    );
  end if;

  if v_reward.reward_xp > 0 or v_reward.reward_gold > 0 then
    perform public.apply_character_xp_gold_atomic(p_character_id, v_reward.reward_xp, v_reward.reward_gold);
  end if;

  if v_reward.reward_item_id is not null and v_reward.reward_item_quantity > 0 then
    perform public.grant_item_to_character_atomic(p_character_id, v_reward.reward_item_id, v_reward.reward_item_quantity);
  end if;

  insert into public.weekly_leaderboard_reward_claims (
    user_id,
    character_id,
    metric,
    rank,
    score,
    week_start,
    week_end,
    reward_id,
    reward_xp,
    reward_gold,
    reward_item_id,
    reward_item_quantity
  )
  values (
    v_user_id,
    p_character_id,
    p_metric,
    v_rank,
    coalesce(v_score, 0),
    v_week_start,
    v_week_end,
    v_reward.id,
    v_reward.reward_xp,
    v_reward.reward_gold,
    v_reward.reward_item_id,
    v_reward.reward_item_quantity
  );

  return jsonb_build_object(
    'claimed', true,
    'eligible', true,
    'rank', v_rank,
    'score', v_score,
    'reward_title', v_reward.title,
    'reward_xp', v_reward.reward_xp,
    'reward_gold', v_reward.reward_gold,
    'reward_item_id', v_reward.reward_item_id,
    'reward_item_quantity', v_reward.reward_item_quantity,
    'message', 'Weekly leaderboard reward claimed.',
    'week_start', v_week_start,
    'week_end', v_week_end
  );
end;
$$;

grant execute on function public.claim_weekly_leaderboard_reward(uuid, text) to authenticated;
