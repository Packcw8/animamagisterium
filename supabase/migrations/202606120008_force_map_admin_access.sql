alter table public.profiles
  add column if not exists role text not null default 'player';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('player', 'moderator', 'admin'));

insert into public.profiles (id, username, role, created_at)
select
  id,
  coalesce(raw_user_meta_data ->> 'username', split_part(email, '@', 1), 'pack8cw'),
  'admin',
  now()
from auth.users
where lower(email) = 'pack8cw@gmail.com'
on conflict (id) do update set role = 'admin';

create or replace function public.is_map_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'pack8cw@gmail.com'
    or exists (
      select 1
      from auth.users
      where id = auth.uid()
        and lower(email) = 'pack8cw@gmail.com'
    )
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
    );
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when public.is_map_admin() then 'admin'
    else coalesce(
      (
        select role
        from public.profiles
        where id = auth.uid()
        limit 1
      ),
      'player'
    )
  end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_map_admin();
$$;

grant execute on function public.is_map_admin() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

grant select, insert, update, delete on public.map_markers to authenticated;
grant select, insert, update, delete on public.map_routes to authenticated;
grant select, insert, update, delete on public.route_progress to authenticated;

drop policy if exists "markers_player_read_active_unlocked" on public.map_markers;
drop policy if exists "markers_player_read" on public.map_markers;
drop policy if exists "markers_admin_insert" on public.map_markers;
drop policy if exists "markers_admin_update" on public.map_markers;
drop policy if exists "markers_admin_delete" on public.map_markers;

create policy "markers_player_read"
  on public.map_markers for select
  to authenticated
  using ((is_active = true and is_unlocked = true and created_by is not null) or public.is_map_admin());

create policy "markers_admin_insert"
  on public.map_markers for insert
  to authenticated
  with check (public.is_map_admin());

create policy "markers_admin_update"
  on public.map_markers for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "markers_admin_delete"
  on public.map_markers for delete
  to authenticated
  using (public.is_map_admin());

drop policy if exists "routes_read_authenticated" on public.map_routes;
drop policy if exists "routes_admin_write" on public.map_routes;
drop policy if exists "routes_player_read" on public.map_routes;
drop policy if exists "routes_admin_insert" on public.map_routes;
drop policy if exists "routes_admin_update" on public.map_routes;
drop policy if exists "routes_admin_delete" on public.map_routes;

create policy "routes_player_read"
  on public.map_routes for select
  to authenticated
  using (is_active = true or public.is_map_admin());

create policy "routes_admin_insert"
  on public.map_routes for insert
  to authenticated
  with check (public.is_map_admin());

create policy "routes_admin_update"
  on public.map_routes for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "routes_admin_delete"
  on public.map_routes for delete
  to authenticated
  using (public.is_map_admin());

delete from public.map_markers
where created_by is null
  or title in (
    'Mirehold Crossing',
    'Wolf Track Bend',
    'Copper Cart Waystation',
    'Broken Moon Cairn',
    'Hollow Watch'
  );
