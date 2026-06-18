create table if not exists public.game_progression_settings (
  id boolean primary key default true,
  character_level_cap integer not null default 100,
  character_xp_base integer not null default 100,
  character_xp_growth integer not null default 0,
  default_attribute_level_cap integer not null default 100,
  daily_training_limit integer not null default 2,
  training_cooldown_minutes integer not null default 60,
  updated_at timestamp with time zone not null default now(),
  constraint game_progression_singleton check (id = true)
);

create table if not exists public.training_attribute_configs (
  attribute_key text primary key check (attribute_key in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')),
  name text not null,
  effect text not null,
  activities text not null,
  unit text not null,
  goal_template text not null default '{value} {unit}',
  starting_goal numeric not null default 1,
  goal_increment numeric not null default 1,
  character_xp_reward integer not null default 25,
  attribute_xp_reward integer not null default 1,
  level_cap integer not null default 100,
  is_active boolean not null default true,
  updated_at timestamp with time zone not null default now()
);

insert into public.game_progression_settings (id)
values (true)
on conflict (id) do nothing;

insert into public.training_attribute_configs
  (attribute_key, name, effect, activities, unit, goal_template, starting_goal, goal_increment, character_xp_reward, attribute_xp_reward, level_cap)
values
  ('strength', 'Strength', 'Increases melee damage and carry power.', 'Workouts, pushups, weights, bodyweight training, physical labor', 'pushups', '{value} pushups or equivalent strength work', 5, 5, 25, 1, 100),
  ('endurance', 'Endurance', 'Increases HP and stamina.', 'Walking, hiking, labor, long physical activity', 'steps', '{value} steps or equivalent endurance work', 1000, 1000, 25, 1, 100),
  ('agility', 'Agility', 'Increases dodge, speed, and critical chance.', 'Running, basketball, martial arts, jump rope', 'miles', '{value} mile run or agility practice', 0.25, 0.25, 25, 1, 100),
  ('intelligence', 'Intelligence', 'Increases magic power and crafting knowledge.', 'Reading, studying, learning a language, taking a course', 'pages', '{value} pages read or focused study', 5, 5, 25, 1, 100),
  ('wisdom', 'Wisdom', 'Increases mana, focus, and resistance.', 'Meditation, journaling, breathing, yoga', 'minutes', '{value} minutes meditation, journaling, or breathwork', 3, 2, 25, 1, 100),
  ('charisma', 'Charisma', 'Increases merchant discounts, reputation, and leadership.', 'Social practice, talking to a stranger, calling someone, community activity', 'interactions', '{value} meaningful social interaction(s)', 1, 1, 25, 1, 100),
  ('spirit', 'Spirit', 'Increases blessing power, corruption resistance, and special story choices.', 'Kindness, helping someone, prayer, faith activity, reflection, service', 'acts', '{value} act(s) of kindness, service, or reflection', 1, 1, 25, 1, 100)
on conflict (attribute_key) do nothing;

alter table public.game_progression_settings enable row level security;
alter table public.training_attribute_configs enable row level security;

grant select, update on public.game_progression_settings to authenticated;
grant select, update on public.training_attribute_configs to authenticated;

drop policy if exists "game_progression_settings_read" on public.game_progression_settings;
drop policy if exists "game_progression_settings_admin_update" on public.game_progression_settings;
drop policy if exists "training_attribute_configs_read" on public.training_attribute_configs;
drop policy if exists "training_attribute_configs_admin_update" on public.training_attribute_configs;

create policy "game_progression_settings_read"
  on public.game_progression_settings for select
  to authenticated
  using (true);

create policy "game_progression_settings_admin_update"
  on public.game_progression_settings for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "training_attribute_configs_read"
  on public.training_attribute_configs for select
  to authenticated
  using (true);

create policy "training_attribute_configs_admin_update"
  on public.training_attribute_configs for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());
