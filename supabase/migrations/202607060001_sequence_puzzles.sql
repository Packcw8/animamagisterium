create table if not exists public.puzzle_definitions (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  title text not null default 'Sequence Puzzle',
  intro_text text,
  image_url text,
  success_text text,
  failure_text text,
  reset_on_failure boolean not null default true,
  max_attempts integer not null default 0,
  unlock_marker_id uuid references public.map_markers(id) on delete set null,
  set_story_flag_key text,
  set_story_flag_value boolean not null default true,
  complete_marker_on_success boolean not null default true,
  is_active boolean not null default true,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.puzzle_tap_zones (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzle_definitions(id) on delete cascade,
  label text not null,
  player_label text,
  clue_text text,
  x_percent numeric not null default 50,
  y_percent numeric not null default 50,
  radius_percent numeric not null default 6,
  sequence_order integer not null default 1,
  icon_label text,
  icon_image_url text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.player_puzzle_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  character_id uuid,
  puzzle_id uuid not null references public.puzzle_definitions(id) on delete cascade,
  marker_id uuid references public.map_markers(id) on delete set null,
  current_index integer not null default 0,
  attempts integer not null default 0,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone not null default now(),
  unique (user_id, puzzle_id)
);

create index if not exists puzzle_definitions_marker_idx
  on public.puzzle_definitions(marker_id, is_active);

create index if not exists puzzle_tap_zones_puzzle_order_idx
  on public.puzzle_tap_zones(puzzle_id, sequence_order);

create index if not exists player_puzzle_progress_user_idx
  on public.player_puzzle_progress(user_id, puzzle_id, completed_at);

alter table public.puzzle_definitions enable row level security;
alter table public.puzzle_tap_zones enable row level security;
alter table public.player_puzzle_progress enable row level security;

grant select, insert, update, delete on public.puzzle_definitions to authenticated;
grant select, insert, update, delete on public.puzzle_tap_zones to authenticated;
grant select, insert, update, delete on public.player_puzzle_progress to authenticated;

drop policy if exists "puzzle_definitions_read" on public.puzzle_definitions;
drop policy if exists "puzzle_definitions_admin_insert" on public.puzzle_definitions;
drop policy if exists "puzzle_definitions_admin_update" on public.puzzle_definitions;
drop policy if exists "puzzle_definitions_admin_delete" on public.puzzle_definitions;

create policy "puzzle_definitions_read"
  on public.puzzle_definitions for select
  using (is_active = true or public.is_admin());

create policy "puzzle_definitions_admin_insert"
  on public.puzzle_definitions for insert
  with check (public.is_admin());

create policy "puzzle_definitions_admin_update"
  on public.puzzle_definitions for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "puzzle_definitions_admin_delete"
  on public.puzzle_definitions for delete
  using (public.is_admin());

drop policy if exists "puzzle_tap_zones_read" on public.puzzle_tap_zones;
drop policy if exists "puzzle_tap_zones_admin_insert" on public.puzzle_tap_zones;
drop policy if exists "puzzle_tap_zones_admin_update" on public.puzzle_tap_zones;
drop policy if exists "puzzle_tap_zones_admin_delete" on public.puzzle_tap_zones;

create policy "puzzle_tap_zones_read"
  on public.puzzle_tap_zones for select
  using (
    exists (
      select 1
      from public.puzzle_definitions p
      where p.id = puzzle_tap_zones.puzzle_id
        and (p.is_active = true or public.is_admin())
    )
  );

create policy "puzzle_tap_zones_admin_insert"
  on public.puzzle_tap_zones for insert
  with check (public.is_admin());

create policy "puzzle_tap_zones_admin_update"
  on public.puzzle_tap_zones for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "puzzle_tap_zones_admin_delete"
  on public.puzzle_tap_zones for delete
  using (public.is_admin());

drop policy if exists "player_puzzle_progress_own_read" on public.player_puzzle_progress;
drop policy if exists "player_puzzle_progress_own_insert" on public.player_puzzle_progress;
drop policy if exists "player_puzzle_progress_own_update" on public.player_puzzle_progress;
drop policy if exists "player_puzzle_progress_admin_delete" on public.player_puzzle_progress;

create policy "player_puzzle_progress_own_read"
  on public.player_puzzle_progress for select
  using (user_id = auth.uid() or public.is_admin());

create policy "player_puzzle_progress_own_insert"
  on public.player_puzzle_progress for insert
  with check (user_id = auth.uid());

create policy "player_puzzle_progress_own_update"
  on public.player_puzzle_progress for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "player_puzzle_progress_admin_delete"
  on public.player_puzzle_progress for delete
  using (public.is_admin());
