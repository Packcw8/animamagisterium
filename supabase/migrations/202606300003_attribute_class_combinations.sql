alter table public.training_attribute_configs
  add column if not exists image_url text,
  add column if not exists background_image_url text;

create table if not exists public.class_definitions (
  id uuid primary key default gen_random_uuid(),
  class_key text not null unique,
  name text not null,
  first_attribute text not null check (first_attribute in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')),
  second_attribute text not null check (second_attribute in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')),
  unlock_level integer not null default 5,
  description text,
  image_url text,
  background_image_url text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.player_class_selection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  class_key text not null,
  updated_at timestamp with time zone not null default now(),
  unique (character_id)
);

insert into public.class_definitions (class_key, name, first_attribute, second_attribute, unlock_level, description)
values
  ('warrior', 'Warrior', 'strength', 'endurance', 5, 'A disciplined front-line combatant built from power and resilience.'),
  ('berserker', 'Berserker', 'strength', 'agility', 5, 'A relentless striker built from force and speed.'),
  ('spellblade', 'Spellblade', 'strength', 'intelligence', 5, 'A warrior-scholar who blends steel with arcane technique.'),
  ('paladin', 'Paladin', 'strength', 'wisdom', 5, 'A devoted defender shaped by strength and judgment.'),
  ('templar', 'Templar', 'strength', 'spirit', 5, 'A sworn champion driven by strength and inner resolve.'),
  ('warlord', 'Warlord', 'strength', 'charisma', 5, 'A commanding fighter who turns presence into battlefield control.'),
  ('ranger', 'Ranger', 'endurance', 'agility', 5, 'A trailwise survivor built for pursuit, distance, and quick action.'),
  ('battlemage', 'Battlemage', 'endurance', 'intelligence', 5, 'A durable caster trained to survive the press of battle.'),
  ('guardian', 'Guardian', 'endurance', 'wisdom', 5, 'A steady protector built from patience and endurance.'),
  ('cleric', 'Cleric', 'endurance', 'spirit', 5, 'A resilient support path grounded in service and conviction.'),
  ('captain', 'Captain', 'endurance', 'charisma', 5, 'A rallying leader who keeps others moving under pressure.'),
  ('rogue', 'Rogue', 'agility', 'intelligence', 5, 'A clever opportunist built from precision and problem solving.'),
  ('monk', 'Monk', 'agility', 'wisdom', 5, 'A focused martial path built from movement and discipline.'),
  ('assassin', 'Assassin', 'agility', 'spirit', 5, 'A shadowed striker shaped by speed and resolve.'),
  ('bard', 'Bard', 'agility', 'charisma', 5, 'A nimble performer who turns timing and charm into advantage.'),
  ('mage', 'Mage', 'intelligence', 'wisdom', 5, 'A learned caster built from study and insight.'),
  ('sorcerer', 'Sorcerer', 'intelligence', 'spirit', 5, 'A forceful spellcaster shaped by knowledge and inner power.'),
  ('enchanter', 'Enchanter', 'intelligence', 'charisma', 5, 'A social arcanist who bends attention and magic together.'),
  ('druid', 'Druid', 'wisdom', 'spirit', 5, 'A nature-attuned path built from insight and spiritual balance.'),
  ('priest', 'Priest', 'wisdom', 'charisma', 5, 'A guiding support path built from care, counsel, and presence.'),
  ('prophet', 'Prophet', 'spirit', 'charisma', 5, 'A visionary path that turns conviction into influence.')
on conflict (class_key) do update
set
  name = excluded.name,
  first_attribute = excluded.first_attribute,
  second_attribute = excluded.second_attribute,
  unlock_level = excluded.unlock_level,
  description = coalesce(public.class_definitions.description, excluded.description),
  updated_at = now();

alter table public.class_definitions enable row level security;
alter table public.player_class_selection enable row level security;

grant select on public.class_definitions to authenticated;
grant insert, update on public.class_definitions to authenticated;
grant select, insert, update, delete on public.player_class_selection to authenticated;

drop policy if exists "class_definitions_read" on public.class_definitions;
drop policy if exists "class_definitions_admin_write" on public.class_definitions;
drop policy if exists "player_class_selection_read_own" on public.player_class_selection;
drop policy if exists "player_class_selection_insert_own" on public.player_class_selection;
drop policy if exists "player_class_selection_update_own" on public.player_class_selection;
drop policy if exists "player_class_selection_delete_own" on public.player_class_selection;

create policy "class_definitions_read"
  on public.class_definitions for select
  to authenticated
  using (is_active = true or public.is_map_admin());

create policy "class_definitions_admin_write"
  on public.class_definitions for all
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "player_class_selection_read_own"
  on public.player_class_selection for select
  to authenticated
  using (user_id = auth.uid());

create policy "player_class_selection_insert_own"
  on public.player_class_selection for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.characters
      where characters.id = player_class_selection.character_id
      and characters.user_id = auth.uid()
    )
  );

create policy "player_class_selection_update_own"
  on public.player_class_selection for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "player_class_selection_delete_own"
  on public.player_class_selection for delete
  to authenticated
  using (user_id = auth.uid());
