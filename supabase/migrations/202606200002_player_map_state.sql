create table if not exists public.player_map_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_mini_map_id uuid references public.mini_maps(id) on delete set null,
  current_x_percent numeric,
  current_y_percent numeric,
  updated_at timestamptz not null default now(),
  constraint player_map_state_current_x_percent_check check (current_x_percent is null or (current_x_percent >= 0 and current_x_percent <= 100)),
  constraint player_map_state_current_y_percent_check check (current_y_percent is null or (current_y_percent >= 0 and current_y_percent <= 100))
);

alter table public.player_map_state enable row level security;

grant select, insert, update, delete on public.player_map_state to authenticated;

drop policy if exists "player_map_state_owner_read" on public.player_map_state;
drop policy if exists "player_map_state_owner_insert" on public.player_map_state;
drop policy if exists "player_map_state_owner_update" on public.player_map_state;
drop policy if exists "player_map_state_owner_delete" on public.player_map_state;

create policy "player_map_state_owner_read"
  on public.player_map_state for select
  to authenticated
  using (auth.uid() = user_id);

create policy "player_map_state_owner_insert"
  on public.player_map_state for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "player_map_state_owner_update"
  on public.player_map_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "player_map_state_owner_delete"
  on public.player_map_state for delete
  to authenticated
  using (auth.uid() = user_id);
