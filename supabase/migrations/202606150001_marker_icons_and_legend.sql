alter table public.map_markers
  add column if not exists icon_label text,
  add column if not exists icon_image_url text,
  add column if not exists icon_color text;

create table if not exists public.marker_legend_items (
  id uuid primary key default gen_random_uuid(),
  marker_type text not null,
  title text not null,
  description text,
  icon_label text,
  icon_image_url text,
  icon_color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.marker_legend_items enable row level security;

grant select, insert, update, delete on public.marker_legend_items to authenticated;

drop policy if exists "marker_legend_items_read" on public.marker_legend_items;
drop policy if exists "marker_legend_items_admin_insert" on public.marker_legend_items;
drop policy if exists "marker_legend_items_admin_update" on public.marker_legend_items;
drop policy if exists "marker_legend_items_admin_delete" on public.marker_legend_items;

create policy "marker_legend_items_read"
  on public.marker_legend_items for select
  using (is_active = true or public.is_map_admin());

create policy "marker_legend_items_admin_insert"
  on public.marker_legend_items for insert
  with check (public.is_map_admin());

create policy "marker_legend_items_admin_update"
  on public.marker_legend_items for update
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "marker_legend_items_admin_delete"
  on public.marker_legend_items for delete
  using (public.is_map_admin());
