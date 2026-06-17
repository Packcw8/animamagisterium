create table if not exists public.map_seasons (
  id uuid primary key default gen_random_uuid(),
  season_number integer not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.map_chapters (
  id uuid primary key default gen_random_uuid(),
  season_number integer not null,
  chapter_number integer not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (season_number, chapter_number)
);

alter table public.map_seasons enable row level security;
alter table public.map_chapters enable row level security;

grant select, insert, update, delete on public.map_seasons to authenticated;
grant select, insert, update, delete on public.map_chapters to authenticated;

drop policy if exists "map_seasons_read" on public.map_seasons;
drop policy if exists "map_seasons_admin_insert" on public.map_seasons;
drop policy if exists "map_seasons_admin_update" on public.map_seasons;
drop policy if exists "map_seasons_admin_delete" on public.map_seasons;

create policy "map_seasons_read"
  on public.map_seasons for select
  to authenticated
  using (true);

create policy "map_seasons_admin_insert"
  on public.map_seasons for insert
  to authenticated
  with check (public.is_admin());

create policy "map_seasons_admin_update"
  on public.map_seasons for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "map_seasons_admin_delete"
  on public.map_seasons for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "map_chapters_read" on public.map_chapters;
drop policy if exists "map_chapters_admin_insert" on public.map_chapters;
drop policy if exists "map_chapters_admin_update" on public.map_chapters;
drop policy if exists "map_chapters_admin_delete" on public.map_chapters;

create policy "map_chapters_read"
  on public.map_chapters for select
  to authenticated
  using (true);

create policy "map_chapters_admin_insert"
  on public.map_chapters for insert
  to authenticated
  with check (public.is_admin());

create policy "map_chapters_admin_update"
  on public.map_chapters for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "map_chapters_admin_delete"
  on public.map_chapters for delete
  to authenticated
  using (public.is_admin());

insert into public.map_seasons (season_number, name, description)
values (1, 'Season 1', 'Initial Animamagisterium season')
on conflict (season_number) do update
set name = coalesce(public.map_seasons.name, excluded.name),
    updated_at = now();

insert into public.map_chapters (season_number, chapter_number, name, description)
values (1, 1, 'Chapter 1', 'Initial map chapter')
on conflict (season_number, chapter_number) do update
set name = coalesce(public.map_chapters.name, excluded.name),
    updated_at = now();
