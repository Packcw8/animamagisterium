create table if not exists public.mini_maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'area' check (type in ('town', 'forest', 'dungeon', 'area', 'tutorial')),
  background_image_url text,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.tutorial_steps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  marker_id uuid references public.map_markers(id) on delete set null,
  mini_map_id uuid references public.mini_maps(id) on delete set null,
  route_id uuid references public.map_routes(id) on delete set null,
  reward_xp integer not null default 0,
  reward_gold integer not null default 0,
  reward_item_id uuid references public.item_definitions(id) on delete set null,
  reward_item_quantity integer not null default 1,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.map_markers
  add column if not exists linked_mini_map_id uuid references public.mini_maps(id) on delete set null,
  add column if not exists mini_map_id uuid references public.mini_maps(id) on delete cascade,
  add column if not exists parent_marker_id uuid references public.map_markers(id) on delete cascade;

alter table public.map_routes
  add column if not exists mini_map_id uuid references public.mini_maps(id) on delete set null,
  add column if not exists parent_marker_id uuid references public.map_markers(id) on delete set null;

alter table public.mini_maps enable row level security;
alter table public.tutorial_steps enable row level security;

grant select, insert, update, delete on public.mini_maps to authenticated;
grant select, insert, update, delete on public.tutorial_steps to authenticated;

drop policy if exists "mini_maps_read" on public.mini_maps;
drop policy if exists "mini_maps_admin_insert" on public.mini_maps;
drop policy if exists "mini_maps_admin_update" on public.mini_maps;
drop policy if exists "mini_maps_admin_delete" on public.mini_maps;

create policy "mini_maps_read"
  on public.mini_maps for select
  using (is_active = true or public.is_map_admin());

create policy "mini_maps_admin_insert"
  on public.mini_maps for insert
  with check (public.is_map_admin());

create policy "mini_maps_admin_update"
  on public.mini_maps for update
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "mini_maps_admin_delete"
  on public.mini_maps for delete
  using (public.is_map_admin());

drop policy if exists "tutorial_steps_read" on public.tutorial_steps;
drop policy if exists "tutorial_steps_admin_insert" on public.tutorial_steps;
drop policy if exists "tutorial_steps_admin_update" on public.tutorial_steps;
drop policy if exists "tutorial_steps_admin_delete" on public.tutorial_steps;

create policy "tutorial_steps_read"
  on public.tutorial_steps for select
  using (is_active = true or public.is_map_admin());

create policy "tutorial_steps_admin_insert"
  on public.tutorial_steps for insert
  with check (public.is_map_admin());

create policy "tutorial_steps_admin_update"
  on public.tutorial_steps for update
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "tutorial_steps_admin_delete"
  on public.tutorial_steps for delete
  using (public.is_map_admin());
