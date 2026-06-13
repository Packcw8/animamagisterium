create table if not exists public.player_abilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  ability_key text not null,
  unlocked_by_attribute text not null check (unlocked_by_attribute in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')),
  unlocked_at timestamp default now(),
  unique (character_id, ability_key)
);

create table if not exists public.equipped_abilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  slot integer not null check (slot between 1 and 4),
  ability_key text,
  updated_at timestamp default now(),
  unique (character_id, slot)
);

alter table public.player_abilities enable row level security;
alter table public.equipped_abilities enable row level security;

grant select, insert, update, delete on public.player_abilities to authenticated;
grant select, insert, update, delete on public.equipped_abilities to authenticated;

drop policy if exists "player_abilities_owner_read" on public.player_abilities;
drop policy if exists "player_abilities_owner_insert" on public.player_abilities;
drop policy if exists "player_abilities_owner_update" on public.player_abilities;
drop policy if exists "player_abilities_owner_delete" on public.player_abilities;

create policy "player_abilities_owner_read"
  on public.player_abilities for select
  using (auth.uid() = user_id);

create policy "player_abilities_owner_insert"
  on public.player_abilities for insert
  with check (auth.uid() = user_id);

create policy "player_abilities_owner_update"
  on public.player_abilities for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "player_abilities_owner_delete"
  on public.player_abilities for delete
  using (auth.uid() = user_id);

drop policy if exists "equipped_abilities_owner_read" on public.equipped_abilities;
drop policy if exists "equipped_abilities_owner_insert" on public.equipped_abilities;
drop policy if exists "equipped_abilities_owner_update" on public.equipped_abilities;
drop policy if exists "equipped_abilities_owner_delete" on public.equipped_abilities;

create policy "equipped_abilities_owner_read"
  on public.equipped_abilities for select
  using (auth.uid() = user_id);

create policy "equipped_abilities_owner_insert"
  on public.equipped_abilities for insert
  with check (auth.uid() = user_id);

create policy "equipped_abilities_owner_update"
  on public.equipped_abilities for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "equipped_abilities_owner_delete"
  on public.equipped_abilities for delete
  using (auth.uid() = user_id);
