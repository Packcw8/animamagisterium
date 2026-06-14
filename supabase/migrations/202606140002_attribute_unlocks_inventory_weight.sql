alter table public.combat_abilities
  add column if not exists required_attribute text check (required_attribute in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')),
  add column if not exists required_attribute_level integer not null default 0;

update public.combat_abilities
set
  required_attribute = case
    when linked_stat in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit') then linked_stat
    else required_attribute
  end,
  required_attribute_level = greatest(required_attribute_level, required_level)
where required_attribute is null
  and linked_stat in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit');

alter table public.item_definitions
  add column if not exists weight numeric not null default 0;

create table if not exists public.game_balance_settings (
  key text primary key,
  value numeric not null,
  updated_at timestamp default now()
);

insert into public.game_balance_settings (key, value)
values
  ('base_carry_weight', 50),
  ('carry_weight_per_strength_level', 10)
on conflict (key) do nothing;

alter table public.game_balance_settings enable row level security;

grant select, insert, update, delete on public.game_balance_settings to authenticated;

drop policy if exists "game_balance_settings_read" on public.game_balance_settings;
drop policy if exists "game_balance_settings_admin_insert" on public.game_balance_settings;
drop policy if exists "game_balance_settings_admin_update" on public.game_balance_settings;
drop policy if exists "game_balance_settings_admin_delete" on public.game_balance_settings;

create policy "game_balance_settings_read"
  on public.game_balance_settings for select
  using (true);

create policy "game_balance_settings_admin_insert"
  on public.game_balance_settings for insert
  with check (public.is_map_admin());

create policy "game_balance_settings_admin_update"
  on public.game_balance_settings for update
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "game_balance_settings_admin_delete"
  on public.game_balance_settings for delete
  using (public.is_map_admin());
