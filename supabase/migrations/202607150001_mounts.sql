create table if not exists public.mount_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  breed text,
  description text,
  image_url text,
  rarity text not null default 'common',
  progress_multiplier numeric not null default 1,
  is_active boolean not null default true,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint mount_definitions_progress_multiplier_check check (progress_multiplier >= 1 and progress_multiplier <= 1.7)
);

create table if not exists public.player_mounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  mount_id uuid not null references public.mount_definitions(id) on delete cascade,
  is_equipped boolean not null default false,
  acquired_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (character_id, mount_id)
);

create unique index if not exists player_mounts_one_equipped_per_character_idx
  on public.player_mounts(character_id)
  where is_equipped;

alter table public.marker_market_items
  alter column item_id drop not null;

alter table public.marker_market_items
  add column if not exists purchase_type text not null default 'item',
  add column if not exists mount_id uuid references public.mount_definitions(id) on delete set null;

alter table public.marker_market_items
  drop constraint if exists marker_market_items_purchase_type_check;

alter table public.marker_market_items
  add constraint marker_market_items_purchase_type_check
  check (purchase_type in ('item', 'mount'));

alter table public.marker_market_items
  drop constraint if exists marker_market_items_purchase_target_check;

alter table public.marker_market_items
  add constraint marker_market_items_purchase_target_check
  check (
    (purchase_type = 'item' and item_id is not null and mount_id is null)
    or
    (purchase_type = 'mount' and mount_id is not null and item_id is null)
  );

alter table public.marker_market_items
  drop constraint if exists marker_market_items_marker_id_item_id_key;

create unique index if not exists marker_market_items_marker_item_unique_idx
  on public.marker_market_items(marker_id, item_id)
  where item_id is not null;

create unique index if not exists marker_market_items_marker_mount_unique_idx
  on public.marker_market_items(marker_id, mount_id)
  where mount_id is not null;

alter table public.mount_definitions enable row level security;
alter table public.player_mounts enable row level security;

drop policy if exists "mount_definitions_read" on public.mount_definitions;
create policy "mount_definitions_read"
  on public.mount_definitions
  for select
  using (is_active = true or public.is_map_admin());

drop policy if exists "mount_definitions_admin_insert" on public.mount_definitions;
create policy "mount_definitions_admin_insert"
  on public.mount_definitions
  for insert
  with check (public.is_map_admin());

drop policy if exists "mount_definitions_admin_update" on public.mount_definitions;
create policy "mount_definitions_admin_update"
  on public.mount_definitions
  for update
  using (public.is_map_admin())
  with check (public.is_map_admin());

drop policy if exists "mount_definitions_admin_delete" on public.mount_definitions;
create policy "mount_definitions_admin_delete"
  on public.mount_definitions
  for delete
  using (public.is_map_admin());

drop policy if exists "player_mounts_owner_read" on public.player_mounts;
create policy "player_mounts_owner_read"
  on public.player_mounts
  for select
  using (auth.uid() = user_id or public.is_map_admin());

drop policy if exists "player_mounts_owner_insert" on public.player_mounts;
create policy "player_mounts_owner_insert"
  on public.player_mounts
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.characters c
      where c.id = character_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "player_mounts_owner_update" on public.player_mounts;
create policy "player_mounts_owner_update"
  on public.player_mounts
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.characters c
      where c.id = character_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.characters c
      where c.id = character_id
        and c.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
