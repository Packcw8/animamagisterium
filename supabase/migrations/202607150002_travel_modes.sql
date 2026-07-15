create table if not exists public.travel_modes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode_type text,
  description text,
  image_url text,
  progress_multiplier numeric not null default 1,
  is_active boolean not null default true,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint travel_modes_progress_multiplier_check check (progress_multiplier >= 1 and progress_multiplier <= 1.7)
);

alter table public.map_routes
  add column if not exists travel_mode_id uuid references public.travel_modes(id) on delete set null;

alter table public.marker_route_links
  add column if not exists travel_mode_id uuid references public.travel_modes(id) on delete set null;

alter table public.route_progress
  add column if not exists active_travel_mode_id uuid references public.travel_modes(id) on delete set null;

create index if not exists map_routes_travel_mode_id_idx on public.map_routes(travel_mode_id);
create index if not exists marker_route_links_travel_mode_id_idx on public.marker_route_links(travel_mode_id);
create index if not exists route_progress_active_travel_mode_id_idx on public.route_progress(active_travel_mode_id);

alter table public.travel_modes enable row level security;

drop policy if exists "travel_modes_read" on public.travel_modes;
create policy "travel_modes_read"
  on public.travel_modes
  for select
  using (is_active = true or public.is_map_admin());

drop policy if exists "travel_modes_admin_insert" on public.travel_modes;
create policy "travel_modes_admin_insert"
  on public.travel_modes
  for insert
  with check (public.is_map_admin());

drop policy if exists "travel_modes_admin_update" on public.travel_modes;
create policy "travel_modes_admin_update"
  on public.travel_modes
  for update
  using (public.is_map_admin())
  with check (public.is_map_admin());

drop policy if exists "travel_modes_admin_delete" on public.travel_modes;
create policy "travel_modes_admin_delete"
  on public.travel_modes
  for delete
  using (public.is_map_admin());

notify pgrst, 'reload schema';
