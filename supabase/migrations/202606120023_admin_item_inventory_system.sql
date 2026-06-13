create table if not exists public.item_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('weapon', 'armor', 'wearable', 'potion', 'revive potion', 'special', 'material', 'misc')),
  rarity text not null default 'common',
  description text,
  image_path text,
  gold_value integer not null default 0,
  stackable boolean not null default false,
  sellable boolean not null default true,
  usable_in_battle boolean not null default false,
  usable_outside_battle boolean not null default false,
  crafting_value integer,
  equipment_slot text check (equipment_slot in ('weapon', 'armor', 'necklace', 'ring', 'charm', 'relic')),
  damage_amount integer not null default 0,
  ability_name text,
  ability_cost_type text not null default 'none' check (ability_cost_type in ('health', 'stamina', 'magika', 'none')),
  ability_cost_amount integer not null default 0,
  elemental_damage_type text not null default 'none' check (elemental_damage_type in ('none', 'fire', 'ice', 'poison', 'lightning', 'shadow', 'holy')),
  elemental_damage_amount integer not null default 0,
  on_hit_effect text check (on_hit_effect in ('restore health per hit', 'restore stamina per hit', 'restore magika per hit', 'burn enemy', 'poison enemy', 'weaken enemy')),
  armor_value integer not null default 0,
  buff_target text check (buff_target in ('max health', 'max stamina', 'max magika', 'strength', 'agility', 'intelligence', 'charisma', 'defense', 'damage', 'gold gain', 'xp gain')),
  buff_amount integer not null default 0,
  potion_target text check (potion_target in ('health', 'stamina', 'magika')),
  restore_amount integer not null default 0,
  restore_percent integer,
  boost_target text check (boost_target in ('health', 'stamina', 'magika', 'strength', 'agility', 'intelligence', 'charisma', 'damage', 'defense', 'gold gain', 'xp gain')),
  boost_amount integer not null default 0,
  passive_mode text check (passive_mode in ('owned', 'equipped')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.player_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id uuid not null references public.item_definitions(id) on delete cascade,
  quantity integer not null default 1,
  acquired_at timestamp default now(),
  updated_at timestamp default now(),
  unique (character_id, item_id)
);

create table if not exists public.equipped_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  slot text not null check (slot in ('weapon', 'armor', 'necklace', 'ring', 'charm', 'relic')),
  item_id uuid references public.item_definitions(id) on delete set null,
  updated_at timestamp default now(),
  unique (character_id, slot)
);

alter table public.item_definitions enable row level security;
alter table public.player_inventory enable row level security;
alter table public.equipped_items enable row level security;

grant select, insert, update, delete on public.item_definitions to authenticated;
grant select, insert, update, delete on public.player_inventory to authenticated;
grant select, insert, update, delete on public.equipped_items to authenticated;

drop policy if exists "item_definitions_read" on public.item_definitions;
drop policy if exists "item_definitions_admin_insert" on public.item_definitions;
drop policy if exists "item_definitions_admin_update" on public.item_definitions;
drop policy if exists "item_definitions_admin_delete" on public.item_definitions;

create policy "item_definitions_read"
  on public.item_definitions for select
  using (is_active = true or public.is_map_admin());

create policy "item_definitions_admin_insert"
  on public.item_definitions for insert
  with check (public.is_map_admin());

create policy "item_definitions_admin_update"
  on public.item_definitions for update
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "item_definitions_admin_delete"
  on public.item_definitions for delete
  using (public.is_map_admin());

drop policy if exists "player_inventory_owner_read" on public.player_inventory;
drop policy if exists "player_inventory_owner_insert" on public.player_inventory;
drop policy if exists "player_inventory_owner_update" on public.player_inventory;
drop policy if exists "player_inventory_owner_delete" on public.player_inventory;

create policy "player_inventory_owner_read"
  on public.player_inventory for select
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_inventory_owner_insert"
  on public.player_inventory for insert
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_inventory_owner_update"
  on public.player_inventory for update
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_inventory_owner_delete"
  on public.player_inventory for delete
  using (auth.uid() = user_id or public.is_map_admin());

drop policy if exists "equipped_items_owner_read" on public.equipped_items;
drop policy if exists "equipped_items_owner_insert" on public.equipped_items;
drop policy if exists "equipped_items_owner_update" on public.equipped_items;
drop policy if exists "equipped_items_owner_delete" on public.equipped_items;

create policy "equipped_items_owner_read"
  on public.equipped_items for select
  using (auth.uid() = user_id or public.is_map_admin());

create policy "equipped_items_owner_insert"
  on public.equipped_items for insert
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "equipped_items_owner_update"
  on public.equipped_items for update
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "equipped_items_owner_delete"
  on public.equipped_items for delete
  using (auth.uid() = user_id or public.is_map_admin());
