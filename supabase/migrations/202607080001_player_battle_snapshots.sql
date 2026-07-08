create table if not exists public.player_battle_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  snapshot_source text not null default 'manual',
  character_name text not null,
  portrait_url text,
  level integer not null default 1,
  xp integer not null default 0,
  active_class_key text,
  max_health integer not null default 30,
  max_stamina integer not null default 12,
  max_magika integer not null default 10,
  current_health integer not null default 30,
  defense integer not null default 10,
  attack_bonus integer not null default 0,
  damage_bonus integer not null default 0,
  attributes jsonb not null default '{}'::jsonb,
  equipped_items jsonb not null default '{}'::jsonb,
  equipped_abilities jsonb not null default '[]'::jsonb,
  inventory_summary jsonb not null default '{}'::jsonb,
  is_current boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table public.player_battle_snapshots
  add column if not exists snapshot_source text not null default 'manual',
  add column if not exists active_class_key text,
  add column if not exists max_health integer not null default 30,
  add column if not exists max_stamina integer not null default 12,
  add column if not exists max_magika integer not null default 10,
  add column if not exists current_health integer not null default 30,
  add column if not exists defense integer not null default 10,
  add column if not exists attack_bonus integer not null default 0,
  add column if not exists damage_bonus integer not null default 0,
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists equipped_items jsonb not null default '{}'::jsonb,
  add column if not exists equipped_abilities jsonb not null default '[]'::jsonb,
  add column if not exists inventory_summary jsonb not null default '{}'::jsonb,
  add column if not exists is_current boolean not null default true,
  add column if not exists created_at timestamp with time zone not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_battle_snapshots_source_check'
      and conrelid = 'public.player_battle_snapshots'::regclass
  ) then
    alter table public.player_battle_snapshots
      add constraint player_battle_snapshots_source_check
      check (snapshot_source in ('manual', 'party_ally', 'arena_holder', 'system'));
  end if;
end $$;

create unique index if not exists player_battle_snapshots_one_current_idx
  on public.player_battle_snapshots(character_id)
  where is_current = true;

create index if not exists player_battle_snapshots_user_idx
  on public.player_battle_snapshots(user_id, is_current, created_at desc);

create index if not exists player_battle_snapshots_character_idx
  on public.player_battle_snapshots(character_id, is_current, created_at desc);

alter table public.player_battle_snapshots enable row level security;

grant select, insert, update, delete on public.player_battle_snapshots to authenticated;

drop policy if exists "player_battle_snapshots_read_current" on public.player_battle_snapshots;
drop policy if exists "player_battle_snapshots_owner_insert" on public.player_battle_snapshots;
drop policy if exists "player_battle_snapshots_owner_update" on public.player_battle_snapshots;
drop policy if exists "player_battle_snapshots_owner_delete" on public.player_battle_snapshots;

create policy "player_battle_snapshots_read_current"
  on public.player_battle_snapshots for select
  using (is_current = true or user_id = auth.uid() or public.is_admin());

create policy "player_battle_snapshots_owner_insert"
  on public.player_battle_snapshots for insert
  with check (user_id = auth.uid() or public.is_admin());

create policy "player_battle_snapshots_owner_update"
  on public.player_battle_snapshots for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "player_battle_snapshots_owner_delete"
  on public.player_battle_snapshots for delete
  using (user_id = auth.uid() or public.is_admin());
