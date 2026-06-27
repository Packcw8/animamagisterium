create or replace function public.claim_dialogue_choice_rewards_atomic(
  p_character_id uuid,
  p_choice_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_choice public.story_dialogue_choices%rowtype;
  v_xp integer := 0;
  v_gold integer := 0;
  v_reward record;
  v_items jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to claim rewards.';
  end if;

  if not exists (
    select 1
    from public.characters
    where id = p_character_id
      and user_id = v_user_id
  ) then
    raise exception 'Character not found for current user.';
  end if;

  select *
  into v_choice
  from public.story_dialogue_choices
  where id = p_choice_id;

  if not found then
    raise exception 'Dialogue choice not found.';
  end if;

  insert into public.marker_reward_claims(user_id, character_id, choice_id)
  values (v_user_id, p_character_id, p_choice_id)
  on conflict (user_id, choice_id) where choice_id is not null do nothing;

  if not found then
    return jsonb_build_object(
      'claimed', false,
      'message', 'Reward already claimed.',
      'xp', 0,
      'gold', 0,
      'items', '[]'::jsonb
    );
  end if;

  v_xp := greatest(0, coalesce(v_choice.reward_xp, 0));
  v_gold := greatest(0, coalesce(v_choice.reward_gold, 0));

  for v_reward in
    select *
    from public.dialogue_choice_rewards
    where choice_id = p_choice_id
  loop
    if v_reward.reward_type = 'xp' then
      v_xp := v_xp + greatest(0, coalesce(v_reward.amount, 0));
    elsif v_reward.reward_type = 'gold' then
      v_gold := v_gold + greatest(0, coalesce(v_reward.amount, 0));
    end if;
  end loop;

  if v_xp > 0 or v_gold > 0 then
    update public.characters
    set
      xp = coalesce(xp, 0) + v_xp,
      gold = coalesce(gold, 0) + v_gold,
      updated_at = now()
    where id = p_character_id
      and user_id = v_user_id;
  end if;

  if v_choice.reward_item_id is not null then
    perform public.grant_item_to_character_atomic(
      p_character_id,
      v_choice.reward_item_id,
      greatest(1, coalesce(v_choice.reward_item_quantity, 1))
    );

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'itemId', v_choice.reward_item_id,
      'quantity', greatest(1, coalesce(v_choice.reward_item_quantity, 1))
    ));
  end if;

  for v_reward in
    select *
    from public.dialogue_choice_rewards
    where choice_id = p_choice_id
      and reward_type = 'item'
      and item_id is not null
  loop
    perform public.grant_item_to_character_atomic(
      p_character_id,
      v_reward.item_id,
      greatest(1, coalesce(v_reward.quantity, 1))
    );

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'itemId', v_reward.item_id,
      'quantity', greatest(1, coalesce(v_reward.quantity, 1))
    ));
  end loop;

  return jsonb_build_object(
    'claimed', true,
    'message', 'Reward claimed.',
    'xp', v_xp,
    'gold', v_gold,
    'items', v_items
  );
end;
$$;

grant execute on function public.claim_dialogue_choice_rewards_atomic(uuid, uuid) to authenticated;
