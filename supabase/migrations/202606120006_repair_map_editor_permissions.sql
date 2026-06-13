create extension if not exists "pgcrypto";

alter table public.profiles
  add column if not exists role text not null default 'player';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('player', 'moderator', 'admin'));

update public.profiles
set role = 'admin'
where id in (
  select id
  from auth.users
  where lower(email) = 'pack8cw@gmail.com'
);

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    case
      when lower(coalesce(auth.jwt() ->> 'email', '')) = 'pack8cw@gmail.com' then 'admin'
      else null
    end,
    (
      select role
      from public.profiles
      where id = auth.uid()
      limit 1
    ),
    'player'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.map_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  terrain text not null default 'Road',
  danger_level text not null default 'Low',
  distance_required_meters numeric not null default 1000,
  estimated_encounters integer not null default 1,
  path_points jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.route_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid not null references public.map_routes(id) on delete cascade,
  distance_walked_meters numeric not null default 0,
  progress_percent numeric not null default 0,
  last_lat numeric,
  last_lng numeric,
  updated_at timestamp default now(),
  unique (user_id, route_id)
);

create table if not exists public.map_markers (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  description text,
  x_percent numeric not null,
  y_percent numeric not null,
  is_active boolean not null default true,
  is_unlocked boolean not null default true,
  quest_key text,
  route_id uuid references public.map_routes(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.map_routes
  add column if not exists name text,
  add column if not exists terrain text not null default 'Road',
  add column if not exists danger_level text not null default 'Low',
  add column if not exists distance_required_meters numeric not null default 1000,
  add column if not exists estimated_encounters integer not null default 1,
  add column if not exists path_points jsonb not null default '[]'::jsonb,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamp default now(),
  add column if not exists updated_at timestamp default now();

alter table public.route_progress
  add column if not exists distance_walked_meters numeric not null default 0,
  add column if not exists progress_percent numeric not null default 0,
  add column if not exists last_lat numeric,
  add column if not exists last_lng numeric,
  add column if not exists updated_at timestamp default now();

alter table public.map_markers
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists x_percent numeric,
  add column if not exists y_percent numeric,
  add column if not exists is_active boolean not null default true,
  add column if not exists is_unlocked boolean not null default true,
  add column if not exists quest_key text,
  add column if not exists route_id uuid references public.map_routes(id) on delete set null,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamp default now(),
  add column if not exists updated_at timestamp default now();

grant select on public.map_routes to authenticated;
grant insert, update, delete on public.map_routes to authenticated;
grant select, insert, update, delete on public.route_progress to authenticated;
grant select, insert, update, delete on public.map_markers to authenticated;

alter table public.map_routes enable row level security;
alter table public.route_progress enable row level security;
alter table public.map_markers enable row level security;

drop policy if exists "routes_read_authenticated" on public.map_routes;
drop policy if exists "routes_admin_write" on public.map_routes;
drop policy if exists "route_progress_owner_read" on public.route_progress;
drop policy if exists "route_progress_owner_insert" on public.route_progress;
drop policy if exists "route_progress_owner_update" on public.route_progress;
drop policy if exists "route_progress_owner_delete" on public.route_progress;
drop policy if exists "markers_player_read_active_unlocked" on public.map_markers;
drop policy if exists "markers_admin_insert" on public.map_markers;
drop policy if exists "markers_admin_update" on public.map_markers;
drop policy if exists "markers_admin_delete" on public.map_markers;

create policy "routes_read_authenticated"
  on public.map_routes for select
  to authenticated
  using (is_active or public.is_admin());

create policy "routes_admin_write"
  on public.map_routes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "route_progress_owner_read"
  on public.route_progress for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "route_progress_owner_insert"
  on public.route_progress for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "route_progress_owner_update"
  on public.route_progress for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "route_progress_owner_delete"
  on public.route_progress for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "markers_player_read_active_unlocked"
  on public.map_markers for select
  to authenticated
  using ((is_active and is_unlocked) or public.is_admin());

create policy "markers_admin_insert"
  on public.map_markers for insert
  to authenticated
  with check (public.is_admin());

create policy "markers_admin_update"
  on public.map_markers for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "markers_admin_delete"
  on public.map_markers for delete
  to authenticated
  using (public.is_admin());

insert into public.map_routes (id, name, terrain, danger_level, distance_required_meters, estimated_encounters, path_points, is_active)
values (
  '11111111-1111-4111-8111-111111111111',
  'Grayfen Road to Hollow Watch',
  'Mire road, broken stone, low fog',
  'Moderate',
  5000,
  3,
  '[{"x":18,"y":70},{"x":28,"y":62},{"x":42,"y":54},{"x":56,"y":41},{"x":68,"y":38}]'::jsonb,
  true
)
on conflict (id) do update set
  name = excluded.name,
  terrain = excluded.terrain,
  danger_level = excluded.danger_level,
  distance_required_meters = excluded.distance_required_meters,
  estimated_encounters = excluded.estimated_encounters,
  path_points = excluded.path_points,
  is_active = excluded.is_active,
  updated_at = now();
