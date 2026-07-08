create or replace function public.complete_arena_challenge(
  p_arena_id uuid,
  p_holder_snapshot_id uuid,
  p_defender_snapshot_id uuid default null,
  p_result text default 'loss',
  p_reward_xp integer default 0,
  p_reward_gold integer default 0
)
returns public.arena_holders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot public.player_battle_snapshots%rowtype;
  v_arena public.arena_spots%rowtype;
  v_existing_holder public.arena_holders%rowtype;
  v_new_holder public.arena_holders%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_result not in ('win', 'loss', 'flee') then
    raise exception 'Invalid arena result: %', p_result;
  end if;

  select *
    into v_arena
    from public.arena_spots
   where id = p_arena_id
     and is_active = true;

  if not found then
    raise exception 'Arena not found';
  end if;

  select *
    into v_snapshot
    from public.player_battle_snapshots
   where id = p_holder_snapshot_id
     and user_id = v_user_id;

  if not found then
    raise exception 'Arena holder snapshot not found for current player';
  end if;

  select *
    into v_existing_holder
    from public.arena_holders
   where arena_id = p_arena_id
     and is_current = true
   for update;

  insert into public.arena_challenge_history (
    arena_id,
    challenger_user_id,
    challenger_character_id,
    defender_snapshot_id,
    result,
    reward_xp,
    reward_gold
  )
  values (
    p_arena_id,
    v_snapshot.user_id,
    v_snapshot.character_id,
    coalesce(p_defender_snapshot_id, v_existing_holder.holder_snapshot_id),
    p_result,
    greatest(0, coalesce(p_reward_xp, 0)),
    greatest(0, coalesce(p_reward_gold, 0))
  );

  if p_result <> 'win' then
    if v_existing_holder.id is not null then
      update public.arena_holders
         set wins_defended = wins_defended + 1
       where id = v_existing_holder.id
       returning * into v_existing_holder;
    end if;

    return v_existing_holder;
  end if;

  if not coalesce(v_arena.allow_holder_replacement, true) and v_existing_holder.id is not null then
    raise exception 'Arena holder replacement is disabled';
  end if;

  update public.arena_holders
     set is_current = false,
         replaced_at = now()
   where arena_id = p_arena_id
     and is_current = true;

  insert into public.arena_holders (
    arena_id,
    holder_user_id,
    holder_character_id,
    holder_snapshot_id,
    wins_defended,
    is_current
  )
  values (
    p_arena_id,
    v_snapshot.user_id,
    v_snapshot.character_id,
    v_snapshot.id,
    0,
    true
  )
  returning * into v_new_holder;

  return v_new_holder;
end;
$$;

grant execute on function public.complete_arena_challenge(uuid, uuid, uuid, text, integer, integer) to authenticated;
