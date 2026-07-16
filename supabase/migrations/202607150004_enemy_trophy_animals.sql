create table if not exists public.enemy_trophy_settings (
  id uuid primary key default gen_random_uuid(),
  enemy_id uuid not null references public.enemy_definitions(id) on delete cascade,
  trophy_enabled boolean not null default false,
  species text,
  leaderboard_enabled boolean not null default true,
  score_formula text not null default 'combined',
  min_weight numeric not null default 0,
  max_weight numeric not null default 0,
  min_antler_spread numeric not null default 0,
  max_antler_spread numeric not null default 0,
  min_horn_length numeric not null default 0,
  max_horn_length numeric not null default 0,
  min_skull_size numeric not null default 0,
  max_skull_size numeric not null default 0,
  min_pelt_quality integer not null default 50,
  max_pelt_quality integer not null default 100,
  rarity_bonus numeric not null default 0,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(enemy_id),
  constraint enemy_trophy_settings_score_formula_check
    check (score_formula in ('weight', 'antlers', 'horns', 'skull', 'pelt', 'combined'))
);

create table if not exists public.enemy_trophy_drop_pool (
  id uuid primary key default gen_random_uuid(),
  enemy_id uuid not null references public.enemy_definitions(id) on delete cascade,
  item_id uuid not null references public.item_definitions(id) on delete cascade,
  min_quantity integer not null default 1,
  max_quantity integer not null default 1,
  drop_chance numeric not null default 100,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(enemy_id, item_id),
  constraint enemy_trophy_drop_pool_quantity_check check (min_quantity >= 1 and max_quantity >= min_quantity),
  constraint enemy_trophy_drop_pool_chance_check check (drop_chance >= 0 and drop_chance <= 100)
);

create table if not exists public.player_trophy_harvests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  enemy_id uuid references public.enemy_definitions(id) on delete set null,
  battle_event_id uuid references public.map_events(id) on delete set null,
  marker_id uuid references public.map_markers(id) on delete set null,
  species text,
  enemy_name text,
  weight numeric not null default 0,
  antler_spread numeric not null default 0,
  horn_length numeric not null default 0,
  skull_size numeric not null default 0,
  pelt_quality integer not null default 0,
  rarity_bonus numeric not null default 0,
  trophy_score numeric not null default 0,
  drops jsonb not null default '[]'::jsonb,
  created_at timestamp default now()
);

create index if not exists enemy_trophy_settings_enemy_idx
  on public.enemy_trophy_settings(enemy_id);

create index if not exists enemy_trophy_drop_pool_enemy_idx
  on public.enemy_trophy_drop_pool(enemy_id);

create index if not exists player_trophy_harvests_character_score_idx
  on public.player_trophy_harvests(character_id, trophy_score desc);

create index if not exists player_trophy_harvests_species_score_idx
  on public.player_trophy_harvests(species, trophy_score desc);

alter table public.enemy_trophy_settings enable row level security;
alter table public.enemy_trophy_drop_pool enable row level security;
alter table public.player_trophy_harvests enable row level security;

grant select, insert, update, delete on public.enemy_trophy_settings to authenticated;
grant select, insert, update, delete on public.enemy_trophy_drop_pool to authenticated;
grant select, insert on public.player_trophy_harvests to authenticated;

drop policy if exists "enemy_trophy_settings_read" on public.enemy_trophy_settings;
drop policy if exists "enemy_trophy_settings_admin_write" on public.enemy_trophy_settings;
drop policy if exists "enemy_trophy_drop_pool_read" on public.enemy_trophy_drop_pool;
drop policy if exists "enemy_trophy_drop_pool_admin_write" on public.enemy_trophy_drop_pool;
drop policy if exists "player_trophy_harvests_read_own" on public.player_trophy_harvests;
drop policy if exists "player_trophy_harvests_insert_own" on public.player_trophy_harvests;
drop policy if exists "player_trophy_harvests_admin_read" on public.player_trophy_harvests;

create policy "enemy_trophy_settings_read"
  on public.enemy_trophy_settings for select
  to authenticated
  using (true);

create policy "enemy_trophy_settings_admin_write"
  on public.enemy_trophy_settings for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "enemy_trophy_drop_pool_read"
  on public.enemy_trophy_drop_pool for select
  to authenticated
  using (true);

create policy "enemy_trophy_drop_pool_admin_write"
  on public.enemy_trophy_drop_pool for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "player_trophy_harvests_read_own"
  on public.player_trophy_harvests for select
  to authenticated
  using (user_id = auth.uid() or public.is_map_admin());

create policy "player_trophy_harvests_insert_own"
  on public.player_trophy_harvests for insert
  to authenticated
  with check (user_id = auth.uid());
