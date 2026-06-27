-- Harden high-traffic player progress writes for concurrent play.
-- Shared world content remains global; player progress/rewards stay scoped per user/character.

create index if not exists route_progress_user_current_idx
  on public.route_progress(user_id, is_current)
  where is_current = true;

create index if not exists route_progress_user_route_idx
  on public.route_progress(user_id, route_id);

create index if not exists map_event_completions_user_event_idx
  on public.map_event_completions(user_id, event_id);

create index if not exists story_marker_completions_user_marker_idx
  on public.story_marker_completions(user_id, marker_id);

create index if not exists story_marker_starts_user_marker_idx
  on public.story_marker_starts(user_id, marker_id);

create index if not exists marker_reward_claims_user_marker_idx
  on public.marker_reward_claims(user_id, marker_id)
  where marker_id is not null;

create index if not exists marker_reward_claims_user_event_idx
  on public.marker_reward_claims(user_id, event_id)
  where event_id is not null;

create index if not exists marker_reward_claims_user_choice_idx
  on public.marker_reward_claims(user_id, choice_id)
  where choice_id is not null;

create or replace function public.apply_character_xp_gold_atomic(
  p_character_id uuid,
  p_xp integer default 0,
  p_gold integer default 0
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_safe_xp integer := greatest(0, coalesce(p_xp, 0));
  v_safe_gold integer := greatest(0, coalesce(p_gold, 0));
  v_settings public.game_progression_settings%rowtype;
  v_character public.characters%rowtype;
  v_next_xp integer;
  v_level integer := 1;
  v_spent integer := 0;
  v_needed integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_settings
  from public.game_progression_settings
  where id = true;

  if not found then
    v_settings.character_level_cap := 100;
    v_settings.character_xp_base := 100;
    v_settings.character_xp_growth := 0;
  end if;

  select * into v_character
  from public.characters
  where id = p_character_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Character not found.';
  end if;

  v_next_xp := greatest(0, coalesce(v_character.xp, 0) + v_safe_xp);

  while v_level < greatest(1, coalesce(v_settings.character_level_cap, 100)) loop
    v_needed := greatest(1, coalesce(v_settings.character_xp_base, 100) + greatest(0, v_level - 1) * greatest(0, coalesce(v_settings.character_xp_growth, 0)));
    if v_next_xp < v_spent + v_needed then
      exit;
    end if;
    v_spent := v_spent + v_needed;
    v_level := v_level + 1;
  end loop;

  update public.characters
  set
    xp = v_next_xp,
    gold = greatest(0, coalesce(gold, 0) + v_safe_gold),
    level = greatest(coalesce(level, 1), v_level)
  where id = p_character_id
    and user_id = v_user_id
  returning * into v_character;

  return v_character;
end;
$$;

create or replace function public.spend_character_gold_atomic(
  p_character_id uuid,
  p_amount integer
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_safe_amount integer := greatest(0, coalesce(p_amount, 0));
  v_character public.characters%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  if v_safe_amount <= 0 then
    select * into v_character
    from public.characters
    where id = p_character_id
      and user_id = v_user_id;
    return v_character;
  end if;

  update public.characters
  set gold = gold - v_safe_amount
  where id = p_character_id
    and user_id = v_user_id
    and gold >= v_safe_amount
  returning * into v_character;

  if not found then
    raise exception 'Requires % gold.', v_safe_amount;
  end if;

  return v_character;
end;
$$;

create or replace function public.grant_item_to_character_atomic(
  p_character_id uuid,
  p_item_id uuid,
  p_quantity integer default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quantity integer := greatest(1, coalesce(p_quantity, 1));
  v_item public.item_definitions%rowtype;
  v_strength numeric := 0;
  v_current_weight numeric := 0;
  v_base_carry numeric := 50;
  v_carry_per_strength numeric := 10;
  v_capacity numeric;
  v_next_weight numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  perform 1
  from public.characters
  where id = p_character_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Character not found.';
  end if;

  select * into v_item
  from public.item_definitions
  where id = p_item_id;

  if not found then
    raise exception 'Item definition could not be found.';
  end if;

  select coalesce(strength, 0) into v_strength
  from public.attributes
  where character_id = p_character_id;

  select coalesce(sum(coalesce(pi.quantity, 0) * coalesce(id.weight, 0)), 0) into v_current_weight
  from public.player_inventory pi
  join public.item_definitions id on id.id = pi.item_id
  where pi.character_id = p_character_id;

  select coalesce(value, 50) into v_base_carry
  from public.game_balance_settings
  where key = 'base_carry_weight';

  select coalesce(value, 10) into v_carry_per_strength
  from public.game_balance_settings
  where key = 'carry_weight_per_strength_level';

  v_capacity := v_base_carry + greatest(0, coalesce(v_strength, 0)) * v_carry_per_strength;
  v_next_weight := v_current_weight + coalesce(v_item.weight, 0) * v_quantity;

  if v_next_weight > v_capacity then
    raise exception 'Inventory too heavy. Inventory would be % / % weight.', round(v_next_weight, 1), round(v_capacity, 1);
  end if;

  insert into public.player_inventory (user_id, character_id, item_id, quantity, updated_at)
  values (v_user_id, p_character_id, p_item_id, v_quantity, now())
  on conflict (character_id, item_id)
  do update set
    quantity = public.player_inventory.quantity + excluded.quantity,
    updated_at = now();
end;
$$;

grant execute on function public.apply_character_xp_gold_atomic(uuid, integer, integer) to authenticated;
grant execute on function public.spend_character_gold_atomic(uuid, integer) to authenticated;
grant execute on function public.grant_item_to_character_atomic(uuid, uuid, integer) to authenticated;
