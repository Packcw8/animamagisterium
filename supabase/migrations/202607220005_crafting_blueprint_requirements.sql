alter table public.crafting_recipes
  add column if not exists required_blueprint_item_id uuid references public.item_definitions(id) on delete set null,
  add column if not exists required_blueprint_quantity integer not null default 1;

alter table public.crafting_recipes
  drop constraint if exists crafting_recipes_required_blueprint_quantity_check;

alter table public.crafting_recipes
  add constraint crafting_recipes_required_blueprint_quantity_check
  check (required_blueprint_quantity >= 1);

create index if not exists crafting_recipes_blueprint_idx
  on public.crafting_recipes (required_blueprint_item_id)
  where required_blueprint_item_id is not null;

create or replace function public.craft_item_atomic(
  p_character_id uuid,
  p_recipe_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipe public.crafting_recipes%rowtype;
  v_output_item public.item_definitions%rowtype;
  v_ingredient record;
  v_inventory_quantity integer;
  v_strength numeric := 0;
  v_current_weight numeric := 0;
  v_material_weight numeric := 0;
  v_base_carry numeric := 100;
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

  select * into v_recipe
  from public.crafting_recipes
  where id = p_recipe_id
    and is_active = true;

  if not found then
    raise exception 'Recipe is not available.';
  end if;

  if v_recipe.required_story_flag_key is not null and not exists (
    select 1
    from public.player_story_flags psf
    where psf.user_id = v_user_id
      and psf.character_id = p_character_id
      and psf.flag_key = v_recipe.required_story_flag_key
      and psf.flag_value = v_recipe.required_story_flag_value
  ) then
    raise exception 'Recipe is locked.';
  end if;

  if v_recipe.required_blueprint_item_id is not null and not exists (
    select 1
    from public.player_inventory pi
    where pi.character_id = p_character_id
      and pi.item_id = v_recipe.required_blueprint_item_id
      and pi.quantity >= greatest(1, coalesce(v_recipe.required_blueprint_quantity, 1))
  ) then
    raise exception 'Recipe blueprint required.';
  end if;

  select * into v_output_item
  from public.item_definitions
  where id = v_recipe.output_item_id
    and is_active = true;

  if not found then
    raise exception 'Crafted item is not available.';
  end if;

  for v_ingredient in
    select cri.item_id, cri.quantity, coalesce(id.weight, 0) as weight
    from public.crafting_recipe_ingredients cri
    join public.item_definitions id on id.id = cri.item_id
    where cri.recipe_id = p_recipe_id
    order by cri.sort_order, cri.created_at
  loop
    select coalesce(quantity, 0) into v_inventory_quantity
    from public.player_inventory
    where character_id = p_character_id
      and item_id = v_ingredient.item_id
    for update;

    if coalesce(v_inventory_quantity, 0) < v_ingredient.quantity then
      raise exception 'Missing required crafting materials.';
    end if;

    v_material_weight := v_material_weight + coalesce(v_ingredient.weight, 0) * v_ingredient.quantity;
  end loop;

  if not exists (select 1 from public.crafting_recipe_ingredients where recipe_id = p_recipe_id) then
    raise exception 'Recipe has no materials.';
  end if;

  select coalesce(strength, 0) into v_strength
  from public.attributes
  where character_id = p_character_id;

  select coalesce(sum(coalesce(pi.quantity, 0) * coalesce(id.weight, 0)), 0) into v_current_weight
  from public.player_inventory pi
  join public.item_definitions id on id.id = pi.item_id
  where pi.character_id = p_character_id;

  select coalesce(value, 100) into v_base_carry
  from public.game_balance_settings
  where key = 'base_carry_weight';

  select coalesce(value, 10) into v_carry_per_strength
  from public.game_balance_settings
  where key = 'carry_weight_per_strength_level';

  v_capacity := v_base_carry + greatest(0, coalesce(v_strength, 0)) * v_carry_per_strength;
  v_next_weight := v_current_weight - v_material_weight + coalesce(v_output_item.weight, 0) * v_recipe.output_quantity;

  if v_next_weight > v_capacity then
    raise exception 'Inventory too heavy. Inventory would be % / % weight.', round(v_next_weight, 1), round(v_capacity, 1);
  end if;

  for v_ingredient in
    select item_id, quantity
    from public.crafting_recipe_ingredients
    where recipe_id = p_recipe_id
  loop
    update public.player_inventory
    set
      quantity = quantity - v_ingredient.quantity,
      updated_at = now()
    where character_id = p_character_id
      and item_id = v_ingredient.item_id;

    delete from public.player_inventory
    where character_id = p_character_id
      and item_id = v_ingredient.item_id
      and quantity <= 0;
  end loop;

  insert into public.player_inventory (user_id, character_id, item_id, quantity, updated_at)
  values (v_user_id, p_character_id, v_recipe.output_item_id, v_recipe.output_quantity, now())
  on conflict (character_id, item_id)
  do update set
    quantity = public.player_inventory.quantity + excluded.quantity,
    updated_at = now();

  return jsonb_build_object(
    'crafted', true,
    'recipe_id', p_recipe_id,
    'output_item_id', v_recipe.output_item_id,
    'output_quantity', v_recipe.output_quantity
  );
end;
$$;
