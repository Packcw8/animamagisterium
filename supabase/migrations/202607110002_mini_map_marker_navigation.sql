create table if not exists public.mini_map_marker_connections (
  id uuid primary key default gen_random_uuid(),
  mini_map_id uuid not null references public.mini_maps(id) on delete cascade,
  from_marker_id uuid not null references public.map_markers(id) on delete cascade,
  to_marker_id uuid not null references public.map_markers(id) on delete cascade,
  is_two_way boolean not null default true,
  is_active boolean not null default true,
  label text,
  sort_order integer not null default 0,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint mini_map_marker_connections_no_self check (from_marker_id <> to_marker_id),
  unique (mini_map_id, from_marker_id, to_marker_id)
);

create table if not exists public.player_mini_map_marker_state (
  user_id uuid not null,
  mini_map_id uuid not null references public.mini_maps(id) on delete cascade,
  current_marker_id uuid references public.map_markers(id) on delete set null,
  previous_marker_id uuid references public.map_markers(id) on delete set null,
  updated_at timestamp with time zone not null default now(),
  primary key (user_id, mini_map_id)
);

create table if not exists public.player_mini_map_marker_discoveries (
  user_id uuid not null,
  mini_map_id uuid not null references public.mini_maps(id) on delete cascade,
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  discovered_at timestamp with time zone not null default now(),
  primary key (user_id, mini_map_id, marker_id)
);

create index if not exists mini_map_marker_connections_from_idx
  on public.mini_map_marker_connections(mini_map_id, from_marker_id, is_active);

create index if not exists mini_map_marker_connections_to_idx
  on public.mini_map_marker_connections(mini_map_id, to_marker_id, is_active);

create index if not exists player_mini_map_marker_state_current_idx
  on public.player_mini_map_marker_state(user_id, mini_map_id, current_marker_id);

alter table public.mini_map_marker_connections enable row level security;
alter table public.player_mini_map_marker_state enable row level security;
alter table public.player_mini_map_marker_discoveries enable row level security;

grant select, insert, update, delete on public.mini_map_marker_connections to authenticated;
grant select, insert, update, delete on public.player_mini_map_marker_state to authenticated;
grant select, insert, update, delete on public.player_mini_map_marker_discoveries to authenticated;

drop policy if exists "mini_map_marker_connections_read" on public.mini_map_marker_connections;
drop policy if exists "mini_map_marker_connections_admin_insert" on public.mini_map_marker_connections;
drop policy if exists "mini_map_marker_connections_admin_update" on public.mini_map_marker_connections;
drop policy if exists "mini_map_marker_connections_admin_delete" on public.mini_map_marker_connections;

create policy "mini_map_marker_connections_read"
  on public.mini_map_marker_connections for select
  using (is_active = true or public.is_admin());

create policy "mini_map_marker_connections_admin_insert"
  on public.mini_map_marker_connections for insert
  with check (public.is_admin());

create policy "mini_map_marker_connections_admin_update"
  on public.mini_map_marker_connections for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "mini_map_marker_connections_admin_delete"
  on public.mini_map_marker_connections for delete
  using (public.is_admin());

drop policy if exists "player_mini_map_marker_state_owner_read" on public.player_mini_map_marker_state;
drop policy if exists "player_mini_map_marker_state_owner_insert" on public.player_mini_map_marker_state;
drop policy if exists "player_mini_map_marker_state_owner_update" on public.player_mini_map_marker_state;
drop policy if exists "player_mini_map_marker_state_owner_delete" on public.player_mini_map_marker_state;

create policy "player_mini_map_marker_state_owner_read"
  on public.player_mini_map_marker_state for select
  using (user_id = auth.uid() or public.is_admin());

create policy "player_mini_map_marker_state_owner_insert"
  on public.player_mini_map_marker_state for insert
  with check (user_id = auth.uid());

create policy "player_mini_map_marker_state_owner_update"
  on public.player_mini_map_marker_state for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "player_mini_map_marker_state_owner_delete"
  on public.player_mini_map_marker_state for delete
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "player_mini_map_marker_discoveries_owner_read" on public.player_mini_map_marker_discoveries;
drop policy if exists "player_mini_map_marker_discoveries_owner_insert" on public.player_mini_map_marker_discoveries;
drop policy if exists "player_mini_map_marker_discoveries_owner_delete" on public.player_mini_map_marker_discoveries;

create policy "player_mini_map_marker_discoveries_owner_read"
  on public.player_mini_map_marker_discoveries for select
  using (user_id = auth.uid() or public.is_admin());

create policy "player_mini_map_marker_discoveries_owner_insert"
  on public.player_mini_map_marker_discoveries for insert
  with check (user_id = auth.uid());

create policy "player_mini_map_marker_discoveries_owner_delete"
  on public.player_mini_map_marker_discoveries for delete
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.move_player_mini_map_marker(
  p_mini_map_id uuid,
  p_destination_marker_id uuid
)
returns public.player_mini_map_marker_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_state public.player_mini_map_marker_state;
  v_destination_exists boolean;
  v_connected boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1
    from public.map_markers m
    where m.id = p_destination_marker_id
      and m.mini_map_id = p_mini_map_id
      and m.is_active = true
  )
  into v_destination_exists;

  if not v_destination_exists then
    raise exception 'Destination marker does not belong to this mini map.';
  end if;

  select *
  into v_state
  from public.player_mini_map_marker_state
  where user_id = v_user_id
    and mini_map_id = p_mini_map_id;

  if v_state.current_marker_id is null then
    raise exception 'No current movement marker is set for this mini map.';
  end if;

  select exists (
    select 1
    from public.mini_map_marker_connections c
    where c.mini_map_id = p_mini_map_id
      and c.is_active = true
      and (
        (c.from_marker_id = v_state.current_marker_id and c.to_marker_id = p_destination_marker_id)
        or
        (c.is_two_way = true and c.to_marker_id = v_state.current_marker_id and c.from_marker_id = p_destination_marker_id)
      )
  )
  into v_connected;

  if not v_connected then
    raise exception 'Destination marker is not connected to current marker.';
  end if;

  insert into public.player_mini_map_marker_discoveries(user_id, mini_map_id, marker_id)
  values (v_user_id, p_mini_map_id, p_destination_marker_id)
  on conflict (user_id, mini_map_id, marker_id) do nothing;

  update public.player_mini_map_marker_state
  set previous_marker_id = current_marker_id,
      current_marker_id = p_destination_marker_id,
      updated_at = now()
  where user_id = v_user_id
    and mini_map_id = p_mini_map_id
  returning *
  into v_state;

  return v_state;
end;
$$;

grant execute on function public.move_player_mini_map_marker(uuid, uuid) to authenticated;
