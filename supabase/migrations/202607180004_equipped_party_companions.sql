create table if not exists public.player_equipped_party_companions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  party_member_user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null references public.player_battle_snapshots(id) on delete restrict,
  slot integer not null default 1,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, character_id, slot)
);

create index if not exists player_equipped_party_companions_user_idx
  on public.player_equipped_party_companions(user_id, character_id, is_active);

create index if not exists player_equipped_party_companions_snapshot_idx
  on public.player_equipped_party_companions(snapshot_id);

alter table public.player_equipped_party_companions enable row level security;

grant select, insert, update, delete on public.player_equipped_party_companions to authenticated;

drop policy if exists "party_companions_self_read" on public.player_equipped_party_companions;
create policy "party_companions_self_read"
  on public.player_equipped_party_companions for select
  to authenticated
  using (public.is_map_admin() or user_id = auth.uid());

drop policy if exists "party_companions_self_insert" on public.player_equipped_party_companions;
create policy "party_companions_self_insert"
  on public.player_equipped_party_companions for insert
  to authenticated
  with check (public.is_map_admin() or user_id = auth.uid());

drop policy if exists "party_companions_self_update" on public.player_equipped_party_companions;
create policy "party_companions_self_update"
  on public.player_equipped_party_companions for update
  to authenticated
  using (public.is_map_admin() or user_id = auth.uid())
  with check (public.is_map_admin() or user_id = auth.uid());

drop policy if exists "party_companions_self_delete" on public.player_equipped_party_companions;
create policy "party_companions_self_delete"
  on public.player_equipped_party_companions for delete
  to authenticated
  using (public.is_map_admin() or user_id = auth.uid());
