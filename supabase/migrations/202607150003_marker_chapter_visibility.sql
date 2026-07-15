create table if not exists public.marker_chapter_visibility (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (marker_id, season_number, chapter_number),
  constraint marker_chapter_visibility_positive_scope check (season_number > 0 and chapter_number > 0)
);

create index if not exists marker_chapter_visibility_marker_idx
  on public.marker_chapter_visibility(marker_id);

create index if not exists marker_chapter_visibility_scope_idx
  on public.marker_chapter_visibility(season_number, chapter_number, marker_id);

alter table public.marker_chapter_visibility enable row level security;

grant select, insert, update, delete on public.marker_chapter_visibility to authenticated;

drop policy if exists "marker_chapter_visibility_read" on public.marker_chapter_visibility;
drop policy if exists "marker_chapter_visibility_admin_insert" on public.marker_chapter_visibility;
drop policy if exists "marker_chapter_visibility_admin_update" on public.marker_chapter_visibility;
drop policy if exists "marker_chapter_visibility_admin_delete" on public.marker_chapter_visibility;

create policy "marker_chapter_visibility_read"
  on public.marker_chapter_visibility for select
  using (true);

create policy "marker_chapter_visibility_admin_insert"
  on public.marker_chapter_visibility for insert
  with check (public.is_admin());

create policy "marker_chapter_visibility_admin_update"
  on public.marker_chapter_visibility for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "marker_chapter_visibility_admin_delete"
  on public.marker_chapter_visibility for delete
  using (public.is_admin());
