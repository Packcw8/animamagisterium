create or replace function public.move_player_mini_map_marker(
  p_mini_map_id uuid,
  p_destination_marker_id uuid
)
returns public.player_mini_map_marker_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_state public.player_mini_map_marker_state;
  v_destination_exists boolean;
  v_explicit_connection boolean;
  v_step_connection boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1
    from public.map_markers m
    where m.id = p_destination_marker_id
      and m.mini_map_id = p_mini_map_id
      and m.is_active = true
      and m.is_unlocked = true
  )
  into v_destination_exists;

  if not v_destination_exists then
    raise exception 'Destination marker does not belong to this mini map.';
  end if;

  select *
  into v_state
  from public.player_mini_map_marker_state
  where user_id = v_user_id
    and mini_map_id = p_mini_map_id;

  if v_state.current_marker_id is null then
    raise exception 'No current movement marker is set for this mini map.';
  end if;

  select exists (
    select 1
    from public.mini_map_marker_connections c
    where c.mini_map_id = p_mini_map_id
      and c.is_active = true
      and (
        (c.from_marker_id = v_state.current_marker_id and c.to_marker_id = p_destination_marker_id)
        or
        (c.is_two_way = true and c.to_marker_id = v_state.current_marker_id and c.from_marker_id = p_destination_marker_id)
      )
  )
  into v_explicit_connection;

  select exists (
    select 1
    from public.map_markers current_marker
    join public.map_markers destination_marker
      on destination_marker.id = p_destination_marker_id
    where current_marker.id = v_state.current_marker_id
      and current_marker.mini_map_id = p_mini_map_id
      and destination_marker.mini_map_id = p_mini_map_id
      and current_marker.type = 'Movement'
      and destination_marker.type = 'Movement'
      and current_marker.is_active = true
      and destination_marker.is_active = true
      and current_marker.is_unlocked = true
      and destination_marker.is_unlocked = true
      and coalesce(current_marker.story_order, 0) > 0
      and coalesce(destination_marker.story_order, 0) > 0
      and abs(coalesce(destination_marker.story_order, 0) - coalesce(current_marker.story_order, 0)) = 1
  )
  into v_step_connection;

  if not (v_explicit_connection or v_step_connection) then
    raise exception 'Destination marker is not connected to current marker.';
  end if;

  insert into public.player_mini_map_marker_discoveries(user_id, mini_map_id, marker_id)
  values (v_user_id, p_mini_map_id, p_destination_marker_id)
  on conflict (user_id, mini_map_id, marker_id) do nothing;

  update public.player_mini_map_marker_state
  set previous_marker_id = current_marker_id,
      current_marker_id = p_destination_marker_id,
      updated_at = now()
  where user_id = v_user_id
    and mini_map_id = p_mini_map_id
  returning *
  into v_state;

  return v_state;
end;
$$;

grant execute on function public.move_player_mini_map_marker(uuid, uuid) to authenticated;
