create table if not exists public.arena_spots (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null unique references public.map_markers(id) on delete cascade,
  name text not null,
  description text,
  background_image_url text,
  entry_cost_gold integer not null default 0,
  reward_xp integer not null default 0,
  reward_gold integer not null default 0,
  required_level integer not null default 1,
  allow_holder_replacement boolean not null default true,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.arena_holders (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arena_spots(id) on delete cascade,
  holder_user_id uuid references auth.users(id) on delete set null,
  holder_character_id uuid references public.characters(id) on delete set null,
  holder_snapshot_id uuid references public.player_battle_snapshots(id) on delete set null,
  wins_defended integer not null default 0,
  won_at timestamp with time zone not null default now(),
  replaced_at timestamp with time zone,
  is_current boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists arena_holders_one_current_per_arena
  on public.arena_holders(arena_id)
  where is_current = true;

create index if not exists arena_holders_arena_rank_idx
  on public.arena_holders(arena_id, wins_defended desc, won_at asc);

create table if not exists public.arena_challenge_history (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arena_spots(id) on delete cascade,
  challenger_user_id uuid references auth.users(id) on delete set null,
  challenger_character_id uuid references public.characters(id) on delete set null,
  defender_snapshot_id uuid references public.player_battle_snapshots(id) on delete set null,
  result text not null default 'preview' check (result in ('win', 'loss', 'flee', 'preview')),
  reward_xp integer not null default 0,
  reward_gold integer not null default 0,
  created_at timestamp with time zone not null default now()
);

alter table public.arena_spots enable row level security;
alter table public.arena_holders enable row level security;
alter table public.arena_challenge_history enable row level security;

drop policy if exists "Arena spots are readable" on public.arena_spots;
create policy "Arena spots are readable"
  on public.arena_spots for select
  using (is_active or public.is_admin());

drop policy if exists "Admins manage arena spots" on public.arena_spots;
create policy "Admins manage arena spots"
  on public.arena_spots for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Arena holders are readable" on public.arena_holders;
create policy "Arena holders are readable"
  on public.arena_holders for select
  using (auth.role() = 'authenticated');

drop policy if exists "Admins manage arena holders" on public.arena_holders;
create policy "Admins manage arena holders"
  on public.arena_holders for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Arena challenge history is readable" on public.arena_challenge_history;
create policy "Arena challenge history is readable"
  on public.arena_challenge_history for select
  using (auth.role() = 'authenticated');

drop policy if exists "Players can create their arena challenge history" on public.arena_challenge_history;
create policy "Players can create their arena challenge history"
  on public.arena_challenge_history for insert
  with check (challenger_user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage arena challenge history" on public.arena_challenge_history;
create policy "Admins manage arena challenge history"
  on public.arena_challenge_history for update
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.arena_spots to authenticated;
grant select, insert, update, delete on public.arena_holders to authenticated;
grant select, insert, update on public.arena_challenge_history to authenticated;
