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
  v_week_start date := public.get_week_start_for_date(current_date);
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

do $$
declare
  v_configured_week_start date := public.get_week_start_for_date(current_date);
  v_default_week_start date := date_trunc('week', now())::date;
begin
  if v_configured_week_start <> v_default_week_start then
    insert into public.player_weekly_distance_stats (
      user_id,
      character_id,
      week_start,
      distance_walked_meters,
      created_at,
      updated_at
    )
    select
      user_id,
      character_id,
      v_configured_week_start,
      distance_walked_meters,
      created_at,
      now()
    from public.player_weekly_distance_stats
    where week_start = v_default_week_start
      and updated_at >= v_configured_week_start
    on conflict (character_id, week_start)
    do update set
      distance_walked_meters = public.player_weekly_distance_stats.distance_walked_meters + excluded.distance_walked_meters,
      updated_at = now();

    delete from public.player_weekly_distance_stats
    where week_start = v_default_week_start
      and updated_at >= v_configured_week_start;
  end if;
end $$;
