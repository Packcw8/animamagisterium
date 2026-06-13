drop trigger if exists protect_profile_role on public.profiles;

insert into public.profiles (id, username, role, created_at)
select
  id,
  coalesce(raw_user_meta_data ->> 'username', split_part(email, '@', 1)),
  'admin',
  now()
from auth.users
where lower(email) in ('packcw8@gmail.com', 'pack8cw@gmail.com')
on conflict (id) do update
set role = 'admin';

create or replace function public.is_map_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) in ('packcw8@gmail.com', 'pack8cw@gmail.com')
    or exists (
      select 1
      from auth.users
      where id = auth.uid()
        and lower(email) in ('packcw8@gmail.com', 'pack8cw@gmail.com')
    )
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_map_admin();
$$;

create or replace function public.prevent_profile_role_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and not public.is_admin() then
    raise exception 'Only admins can change profile roles.';
  end if;

  return new;
end;
$$;

create trigger protect_profile_role
  before update of role on public.profiles
  for each row
  execute function public.prevent_profile_role_self_promotion();

create table if not exists public.map_story_instances (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.map_routes(id) on delete cascade,
  title text not null,
  body text,
  trigger_type text not null default 'progress' check (trigger_type in ('progress', 'random')),
  trigger_percent numeric check (trigger_percent is null or (trigger_percent >= 0 and trigger_percent <= 100)),
  chance_percent numeric not null default 20 check (chance_percent >= 0 and chance_percent <= 100),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.map_story_instances enable row level security;

grant select, insert, update, delete on public.map_story_instances to authenticated;
grant execute on function public.is_map_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "story_instances_player_read" on public.map_story_instances;
drop policy if exists "story_instances_admin_insert" on public.map_story_instances;
drop policy if exists "story_instances_admin_update" on public.map_story_instances;
drop policy if exists "story_instances_admin_delete" on public.map_story_instances;

create policy "story_instances_player_read"
  on public.map_story_instances
  for select
  to authenticated
  using (is_active = true or public.is_map_admin());

create policy "story_instances_admin_insert"
  on public.map_story_instances
  for insert
  to authenticated
  with check (public.is_map_admin());

create policy "story_instances_admin_update"
  on public.map_story_instances
  for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "story_instances_admin_delete"
  on public.map_story_instances
  for delete
  to authenticated
  using (public.is_map_admin());
