alter table public.player_inbox_rewards
  add column if not exists source_type text,
  add column if not exists source_key text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists player_inbox_rewards_source_unique
  on public.player_inbox_rewards(source_type, source_key)
  where source_type is not null and source_key is not null;

update public.weekly_leaderboard_settings
set week_starts_on = 2,
    updated_at = now()
where id = true;

create or replace function public.settle_weekly_leaderboard_rewards(
  p_week_start date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := coalesce(p_week_start, public.get_week_start_for_date(current_date) - 7);
  v_week_end date;
  v_awarded integer := 0;
  v_checked integer := 0;
  v_row record;
  v_claim_id uuid;
  v_source_key text;
  v_metric_label text;
begin
  v_week_end := v_week_start + 7;

  for v_row in
    with ranked_entries as (
      select
        'total_distance_walked_meters'::text as metric,
        pwd.character_id,
        c.user_id,
        sum(pwd.distance_walked_meters)::numeric as score,
        row_number() over (partition by 'total_distance_walked_meters' order by sum(pwd.distance_walked_meters) desc, min(pwd.updated_at) asc, pwd.character_id asc)::integer as rank
      from public.player_weekly_distance_stats pwd
      join public.characters c on c.id = pwd.character_id
      where pwd.week_start = v_week_start
      group by pwd.character_id, c.user_id

      union all

      select
        'training_sessions_completed'::text as metric,
        ts.character_id,
        c.user_id,
        count(*)::numeric as score,
        row_number() over (partition by 'training_sessions_completed' order by count(*) desc, min(ts.completed_at) asc, ts.character_id asc)::integer as rank
      from public.training_sessions ts
      join public.characters c on c.id = ts.character_id
      where ts.completed_at >= v_week_start
        and ts.completed_at < v_week_end
      group by ts.character_id, c.user_id

      union all

      select
        'event_completions'::text as metric,
        c.id as character_id,
        c.user_id,
        count(*)::numeric as score,
        row_number() over (partition by 'event_completions' order by count(*) desc, min(mec.completed_at) asc, c.id asc)::integer as rank
      from public.map_event_completions mec
      join public.characters c on c.user_id = mec.user_id
      where mec.completed_at >= v_week_start
        and mec.completed_at < v_week_end
      group by c.id, c.user_id

      union all

      select
        'total_enemy_kills'::text as metric,
        ekl.character_id,
        c.user_id,
        count(*)::numeric as score,
        row_number() over (partition by 'total_enemy_kills' order by count(*) desc, min(ekl.killed_at) asc, ekl.character_id asc)::integer as rank
      from public.enemy_kill_log ekl
      join public.characters c on c.id = ekl.character_id
      where ekl.killed_at >= v_week_start
        and ekl.killed_at < v_week_end
      group by ekl.character_id, c.user_id

      union all

      select
        'trophies'::text as metric,
        pth.character_id,
        pth.user_id,
        pth.trophy_score::numeric as score,
        row_number() over (partition by 'trophies' order by pth.trophy_score desc, pth.created_at asc, pth.id asc)::integer as rank
      from public.player_trophy_harvests pth
      where pth.created_at >= v_week_start
        and pth.created_at < v_week_end
    )
    select
      ranked_entries.metric,
      ranked_entries.character_id,
      ranked_entries.user_id,
      ranked_entries.score,
      ranked_entries.rank,
      rewards.id as reward_id,
      rewards.title,
      rewards.reward_xp,
      rewards.reward_gold,
      rewards.reward_item_id,
      rewards.reward_item_quantity
    from ranked_entries
    join public.weekly_leaderboard_rewards rewards
      on rewards.metric = ranked_entries.metric
     and rewards.rank = ranked_entries.rank
     and rewards.is_active = true
    where ranked_entries.rank between 1 and 3
    order by ranked_entries.metric, ranked_entries.rank
  loop
    v_checked := v_checked + 1;
    v_source_key := concat('weekly:', v_row.metric, ':', v_week_start::text, ':', v_row.character_id::text);

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
      v_row.user_id,
      v_row.character_id,
      v_row.metric,
      v_row.rank,
      coalesce(v_row.score, 0),
      v_week_start,
      v_week_end,
      v_row.reward_id,
      coalesce(v_row.reward_xp, 0),
      coalesce(v_row.reward_gold, 0),
      v_row.reward_item_id,
      greatest(1, coalesce(v_row.reward_item_quantity, 1))
    )
    on conflict (character_id, metric, week_start) do nothing
    returning id into v_claim_id;

    if v_claim_id is not null then
      if coalesce(v_row.reward_xp, 0) > 0 or coalesce(v_row.reward_gold, 0) > 0 then
        perform public.apply_character_xp_gold_atomic(v_row.character_id, coalesce(v_row.reward_xp, 0), coalesce(v_row.reward_gold, 0));
      end if;

      if v_row.reward_item_id is not null and coalesce(v_row.reward_item_quantity, 0) > 0 then
        perform public.grant_item_to_character_atomic(v_row.character_id, v_row.reward_item_id, greatest(1, v_row.reward_item_quantity));
      end if;

      v_metric_label := case v_row.metric
        when 'total_distance_walked_meters' then 'Distance'
        when 'training_sessions_completed' then 'Training'
        when 'event_completions' then 'Events'
        when 'total_enemy_kills' then 'Enemy Kills'
        when 'trophies' then 'Trophies'
        else v_row.metric
      end;

      insert into public.player_inbox_rewards (
        user_id,
        character_id,
        title,
        body,
        reward_xp,
        reward_gold,
        reward_item_id,
        reward_item_quantity,
        is_claimed,
        claimed_at,
        source_type,
        source_key,
        source_metadata
      )
      values (
        v_row.user_id,
        v_row.character_id,
        coalesce(nullif(v_row.title, ''), concat('Weekly ', v_metric_label, ' Reward')),
        concat(
          'You placed #', v_row.rank,
          ' on the ', v_metric_label,
          ' board for ', to_char(v_week_start, 'Mon DD'),
          ' to ', to_char(v_week_end, 'Mon DD'),
          '. Your reward has already been delivered.'
        ),
        coalesce(v_row.reward_xp, 0),
        coalesce(v_row.reward_gold, 0),
        v_row.reward_item_id,
        greatest(1, coalesce(v_row.reward_item_quantity, 1)),
        true,
        now(),
        'weekly_leaderboard',
        v_source_key,
        jsonb_build_object(
          'metric', v_row.metric,
          'rank', v_row.rank,
          'score', coalesce(v_row.score, 0),
          'week_start', v_week_start,
          'week_end', v_week_end,
          'claim_id', v_claim_id
        )
      )
      on conflict (source_type, source_key) do nothing;

      v_awarded := v_awarded + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'settled', true,
    'week_start', v_week_start,
    'week_end', v_week_end,
    'checked', v_checked,
    'awarded', v_awarded
  );
end;
$$;

grant execute on function public.settle_weekly_leaderboard_rewards(date) to authenticated;
