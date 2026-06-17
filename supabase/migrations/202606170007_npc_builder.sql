create table if not exists public.npc_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  description text,
  image_url text,
  can_battle boolean not null default false,
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

create table if not exists public.npc_abilities (
  id uuid primary key default gen_random_uuid(),
  npc_id uuid not null references public.npc_definitions(id) on delete cascade,
  ability_id uuid not null references public.combat_abilities(id) on delete cascade,
  use_weight integer not null default 1,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (npc_id, ability_id)
);

create table if not exists public.npc_item_drops (
  id uuid primary key default gen_random_uuid(),
  npc_id uuid not null references public.npc_definitions(id) on delete cascade,
  item_id uuid not null references public.item_definitions(id) on delete cascade,
  quantity integer not null default 1,
  drop_chance integer not null default 100,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (npc_id, item_id)
);

alter table public.map_events
  add column if not exists npc_id uuid references public.npc_definitions(id) on delete set null;

alter table public.story_dialogue_nodes
  add column if not exists npc_id uuid references public.npc_definitions(id) on delete set null;

alter table public.map_events
  add column if not exists dialogue_npc_id uuid references public.npc_definitions(id) on delete set null;

alter table public.npc_definitions enable row level security;
alter table public.npc_abilities enable row level security;
alter table public.npc_item_drops enable row level security;

grant select, insert, update, delete on public.npc_definitions to authenticated;
grant select, insert, update, delete on public.npc_abilities to authenticated;
grant select, insert, update, delete on public.npc_item_drops to authenticated;

drop policy if exists "npc_definitions_read" on public.npc_definitions;
drop policy if exists "npc_definitions_admin_insert" on public.npc_definitions;
drop policy if exists "npc_definitions_admin_update" on public.npc_definitions;
drop policy if exists "npc_definitions_admin_delete" on public.npc_definitions;

create policy "npc_definitions_read"
  on public.npc_definitions for select
  to authenticated
  using (is_active = true or public.is_map_admin());

create policy "npc_definitions_admin_insert"
  on public.npc_definitions for insert
  to authenticated
  with check (public.is_map_admin());

create policy "npc_definitions_admin_update"
  on public.npc_definitions for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "npc_definitions_admin_delete"
  on public.npc_definitions for delete
  to authenticated
  using (public.is_map_admin());

drop policy if exists "npc_abilities_read" on public.npc_abilities;
drop policy if exists "npc_abilities_admin_write" on public.npc_abilities;
drop policy if exists "npc_item_drops_read" on public.npc_item_drops;
drop policy if exists "npc_item_drops_admin_write" on public.npc_item_drops;

create policy "npc_abilities_read"
  on public.npc_abilities for select
  to authenticated
  using (true);

create policy "npc_abilities_admin_write"
  on public.npc_abilities for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "npc_item_drops_read"
  on public.npc_item_drops for select
  to authenticated
  using (true);

create policy "npc_item_drops_admin_write"
  on public.npc_item_drops for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());
