create table if not exists public.combat_abilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'attack' check (type in ('attack', 'heal', 'buff', 'debuff', 'defense', 'passive')),
  damage integer not null default 0,
  healing integer not null default 0,
  defense_amount integer not null default 0,
  stamina_cost integer not null default 0,
  magika_cost integer not null default 0,
  health_cost integer not null default 0,
  hit_chance integer not null default 75,
  critical_chance integer not null default 5,
  critical_multiplier numeric not null default 2,
  cooldown_turns integer not null default 0,
  duration_turns integer not null default 0,
  status_effect text not null default 'none' check (status_effect in ('none', 'poison', 'burn', 'regen', 'shield', 'weakness', 'slow', 'stun')),
  effect_amount integer not null default 0,
  effect_duration integer not null default 0,
  linked_stat text not null default 'none' check (linked_stat in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit', 'weapon', 'item', 'none')),
  learn_method text not null default 'admin' check (learn_method in ('level', 'weapon equipped', 'armor equipped', 'wearable equipped', 'scroll', 'quest', 'admin')),
  required_level integer not null default 0,
  image_path text,
  attack_bonus integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.enemy_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  image_url text,
  health integer not null default 20,
  stamina integer not null default 10,
  magika integer not null default 0,
  strength integer not null default 0,
  endurance integer not null default 0,
  agility integer not null default 0,
  intelligence integer not null default 0,
  wisdom integer not null default 0,
  charisma integer not null default 0,
  spirit integer not null default 0,
  defense integer not null default 10,
  armor_rating integer not null default 0,
  xp_reward integer not null default 0,
  gold_reward integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.enemy_abilities (
  id uuid primary key default gen_random_uuid(),
  enemy_id uuid not null references public.enemy_definitions(id) on delete cascade,
  ability_id uuid not null references public.combat_abilities(id) on delete cascade,
  use_weight integer not null default 1,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (enemy_id, ability_id)
);

create table if not exists public.enemy_item_drops (
  id uuid primary key default gen_random_uuid(),
  enemy_id uuid not null references public.enemy_definitions(id) on delete cascade,
  item_id uuid not null references public.item_definitions(id) on delete cascade,
  quantity integer not null default 1,
  drop_chance integer not null default 100,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (enemy_id, item_id)
);

alter table public.map_events
  add column if not exists enemy_id uuid references public.enemy_definitions(id) on delete set null;

alter table public.item_definitions
  drop constraint if exists item_definitions_type_check;

alter table public.item_definitions
  add constraint item_definitions_type_check
  check (type in ('weapon', 'armor', 'wearable', 'potion', 'revive potion', 'consumable', 'food', 'scroll', 'special', 'material', 'misc'));

alter table public.item_definitions
  add column if not exists linked_ability_id uuid references public.combat_abilities(id) on delete set null,
  add column if not exists teaches_ability_id uuid references public.combat_abilities(id) on delete set null;

alter table public.combat_abilities enable row level security;
alter table public.enemy_definitions enable row level security;
alter table public.enemy_abilities enable row level security;
alter table public.enemy_item_drops enable row level security;

grant select, insert, update, delete on public.combat_abilities to authenticated;
grant select, insert, update, delete on public.enemy_definitions to authenticated;
grant select, insert, update, delete on public.enemy_abilities to authenticated;
grant select, insert, update, delete on public.enemy_item_drops to authenticated;

drop policy if exists "combat_abilities_read" on public.combat_abilities;
drop policy if exists "combat_abilities_admin_insert" on public.combat_abilities;
drop policy if exists "combat_abilities_admin_update" on public.combat_abilities;
drop policy if exists "combat_abilities_admin_delete" on public.combat_abilities;

create policy "combat_abilities_read"
  on public.combat_abilities for select
  to authenticated
  using (is_active = true or public.is_map_admin());

create policy "combat_abilities_admin_insert"
  on public.combat_abilities for insert
  to authenticated
  with check (public.is_map_admin());

create policy "combat_abilities_admin_update"
  on public.combat_abilities for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "combat_abilities_admin_delete"
  on public.combat_abilities for delete
  to authenticated
  using (public.is_map_admin());

drop policy if exists "enemy_definitions_read" on public.enemy_definitions;
drop policy if exists "enemy_definitions_admin_insert" on public.enemy_definitions;
drop policy if exists "enemy_definitions_admin_update" on public.enemy_definitions;
drop policy if exists "enemy_definitions_admin_delete" on public.enemy_definitions;

create policy "enemy_definitions_read"
  on public.enemy_definitions for select
  to authenticated
  using (is_active = true or public.is_map_admin());

create policy "enemy_definitions_admin_insert"
  on public.enemy_definitions for insert
  to authenticated
  with check (public.is_map_admin());

create policy "enemy_definitions_admin_update"
  on public.enemy_definitions for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "enemy_definitions_admin_delete"
  on public.enemy_definitions for delete
  to authenticated
  using (public.is_map_admin());

drop policy if exists "enemy_abilities_read" on public.enemy_abilities;
drop policy if exists "enemy_abilities_admin_write" on public.enemy_abilities;
drop policy if exists "enemy_item_drops_read" on public.enemy_item_drops;
drop policy if exists "enemy_item_drops_admin_write" on public.enemy_item_drops;

create policy "enemy_abilities_read"
  on public.enemy_abilities for select
  to authenticated
  using (true);

create policy "enemy_abilities_admin_write"
  on public.enemy_abilities for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "enemy_item_drops_read"
  on public.enemy_item_drops for select
  to authenticated
  using (true);

create policy "enemy_item_drops_admin_write"
  on public.enemy_item_drops for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());
