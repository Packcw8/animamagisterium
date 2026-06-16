alter table public.route_progress
  add column if not exists travel_direction text not null default 'forward'
    check (travel_direction in ('forward', 'reverse')),
  add column if not exists is_current boolean not null default false;

create table if not exists public.marker_route_links (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  route_id uuid not null references public.map_routes(id) on delete cascade,
  sort_order integer not null default 0,
  destination_label text,
  starts_on_select boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(marker_id, route_id)
);

alter table public.marker_route_links enable row level security;

grant select, insert, update, delete on public.marker_route_links to authenticated;

drop policy if exists "marker_route_links_read" on public.marker_route_links;
drop policy if exists "marker_route_links_admin_insert" on public.marker_route_links;
drop policy if exists "marker_route_links_admin_update" on public.marker_route_links;
drop policy if exists "marker_route_links_admin_delete" on public.marker_route_links;

create policy "marker_route_links_read"
  on public.marker_route_links for select
  using (
    public.is_map_admin()
    or exists (
      select 1 from public.map_markers
      where map_markers.id = marker_route_links.marker_id
        and map_markers.is_active = true
        and map_markers.is_unlocked = true
    )
  );

create policy "marker_route_links_admin_insert"
  on public.marker_route_links for insert
  with check (public.is_map_admin());

create policy "marker_route_links_admin_update"
  on public.marker_route_links for update
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "marker_route_links_admin_delete"
  on public.marker_route_links for delete
  using (public.is_map_admin());
