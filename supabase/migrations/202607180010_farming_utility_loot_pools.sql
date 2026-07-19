alter table public.map_routes
  add column if not exists required_item_id uuid references public.item_definitions(id) on delete set null,
  add column if not exists required_item_quantity integer not null default 1,
  add column if not exists required_utility_activity text,
  add column if not exists farming_loot_pool_id uuid;

update public.map_routes
set required_item_quantity = greatest(1, coalesce(required_item_quantity, 1));

create index if not exists map_routes_required_item_idx
  on public.map_routes(required_item_id)
  where required_item_id is not null;

alter table public.item_definitions
  add column if not exists utility_activity text,
  add column if not exists rarity_bonus_percent numeric not null default 0,
  add column if not exists extra_roll_chance_percent numeric not null default 0,
  add column if not exists loot_pool_key text,
  add column if not exists break_chance_percent numeric not null default 0,
  add column if not exists utility_uses integer;

update public.item_definitions
set
  rarity_bonus_percent = greatest(0, coalesce(rarity_bonus_percent, 0)),
  extra_roll_chance_percent = greatest(0, coalesce(extra_roll_chance_percent, 0)),
  break_chance_percent = greatest(0, coalesce(break_chance_percent, 0));

create index if not exists item_definitions_utility_activity_idx
  on public.item_definitions(utility_activity)
  where utility_activity is not null;

create table if not exists public.farming_loot_pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pool_key text not null,
  activity_type text not null default 'general',
  description text,
  required_item_id uuid references public.item_definitions(id) on delete set null,
  content_scope text not null default 'chapter',
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint farming_loot_pools_content_scope_check check (content_scope in ('chapter', 'universal')),
  constraint farming_loot_pools_pool_key_unique unique (pool_key)
);

create table if not exists public.farming_loot_pool_items (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.farming_loot_pools(id) on delete cascade,
  item_id uuid not null references public.item_definitions(id) on delete cascade,
  rarity text not null default 'common',
  drop_weight numeric not null default 1,
  min_quantity integer not null default 1,
  max_quantity integer not null default 1,
  required_utility_item_id uuid references public.item_definitions(id) on delete set null,
  bonus_weight_if_utility numeric not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint farming_loot_pool_items_rarity_check check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  constraint farming_loot_pool_items_weight_check check (drop_weight >= 0),
  constraint farming_loot_pool_items_quantity_check check (min_quantity >= 1 and max_quantity >= min_quantity)
);

alter table public.map_routes
  drop constraint if exists map_routes_farming_loot_pool_id_fkey;

alter table public.map_routes
  add constraint map_routes_farming_loot_pool_id_fkey
  foreign key (farming_loot_pool_id) references public.farming_loot_pools(id) on delete set null;

create index if not exists farming_loot_pools_scope_idx
  on public.farming_loot_pools(content_scope, season_number, chapter_number, activity_type);

create index if not exists farming_loot_pool_items_pool_idx
  on public.farming_loot_pool_items(pool_id, sort_order);
