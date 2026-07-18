create table if not exists public.crafting_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  output_item_id uuid not null references public.item_definitions(id) on delete cascade,
  output_quantity integer not null default 1 check (output_quantity >= 1),
  station_type text,
  required_story_flag_key text,
  required_story_flag_value boolean not null default true,
  is_active boolean not null default true,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.crafting_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.crafting_recipes(id) on delete cascade,
  item_id uuid not null references public.item_definitions(id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 1),
  sort_order integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (recipe_id, item_id)
);

create index if not exists crafting_recipes_chapter_idx
  on public.crafting_recipes (season_number, chapter_number, is_active);

create index if not exists crafting_recipe_ingredients_recipe_idx
  on public.crafting_recipe_ingredients (recipe_id, sort_order);

alter table public.crafting_recipes enable row level security;
alter table public.crafting_recipe_ingredients enable row level security;

drop policy if exists "crafting_recipes_read" on public.crafting_recipes;
create policy "crafting_recipes_read"
  on public.crafting_recipes
  for select
  to authenticated
  using (is_active = true or public.is_map_admin());

drop policy if exists "crafting_recipes_admin_insert" on public.crafting_recipes;
create policy "crafting_recipes_admin_insert"
  on public.crafting_recipes
  for insert
  to authenticated
  with check (public.is_map_admin());

drop policy if exists "crafting_recipes_admin_update" on public.crafting_recipes;
create policy "crafting_recipes_admin_update"
  on public.crafting_recipes
  for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

drop policy if exists "crafting_recipes_admin_delete" on public.crafting_recipes;
create policy "crafting_recipes_admin_delete"
  on public.crafting_recipes
  for delete
  to authenticated
  using (public.is_map_admin());

drop policy if exists "crafting_recipe_ingredients_read" on public.crafting_recipe_ingredients;
create policy "crafting_recipe_ingredients_read"
  on public.crafting_recipe_ingredients
  for select
  to authenticated
  using (
    public.is_map_admin()
    or exists (
      select 1
      from public.crafting_recipes cr
      where cr.id = recipe_id
        and cr.is_active = true
    )
  );

drop policy if exists "crafting_recipe_ingredients_admin_insert" on public.crafting_recipe_ingredients;
create policy "crafting_recipe_ingredients_admin_insert"
  on public.crafting_recipe_ingredients
  for insert
  to authenticated
  with check (public.is_map_admin());

drop policy if exists "crafting_recipe_ingredients_admin_update" on public.crafting_recipe_ingredients;
create policy "crafting_recipe_ingredients_admin_update"
  on public.crafting_recipe_ingredients
  for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

drop policy if exists "crafting_recipe_ingredients_admin_delete" on public.crafting_recipe_ingredients;
create policy "crafting_recipe_ingredients_admin_delete"
  on public.crafting_recipe_ingredients
  for delete
  to authenticated
  using (public.is_map_admin());

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

  select coalesce(value, 50) into v_base_carry
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

grant execute on function public.craft_item_atomic(uuid, uuid) to authenticated;
