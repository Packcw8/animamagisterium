create table if not exists public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  badge_type text not null check (badge_type in ('distance', 'enemy_type_kills', 'story_completion', 'training_sessions')),
  metric_key text,
  target_value integer not null default 1,
  icon_url text,
  icon_label text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  season_number integer not null default 1,
  chapter_number integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.player_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  badge_id uuid not null references public.badge_definitions(id) on delete cascade,
  progress_value integer not null default 0,
  is_earned boolean not null default false,
  earned_at timestamp with time zone,
  updated_at timestamp with time zone not null default now(),
  unique(character_id, badge_id)
);

create index if not exists badge_definitions_type_idx on public.badge_definitions(badge_type, is_active, sort_order);
create index if not exists player_badges_character_idx on public.player_badges(character_id, is_earned);

alter table public.badge_definitions enable row level security;
alter table public.player_badges enable row level security;

grant select, insert, update, delete on public.badge_definitions to authenticated;
grant select, insert, update on public.player_badges to authenticated;

drop policy if exists "badge_definitions_read" on public.badge_definitions;
drop policy if exists "badge_definitions_admin_insert" on public.badge_definitions;
drop policy if exists "badge_definitions_admin_update" on public.badge_definitions;
drop policy if exists "badge_definitions_admin_delete" on public.badge_definitions;
drop policy if exists "player_badges_owner_read" on public.player_badges;
drop policy if exists "player_badges_owner_insert" on public.player_badges;
drop policy if exists "player_badges_owner_update" on public.player_badges;

create policy "badge_definitions_read"
  on public.badge_definitions for select
  using (is_active = true or public.is_map_admin());

create policy "badge_definitions_admin_insert"
  on public.badge_definitions for insert
  with check (public.is_map_admin());

create policy "badge_definitions_admin_update"
  on public.badge_definitions for update
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "badge_definitions_admin_delete"
  on public.badge_definitions for delete
  using (public.is_map_admin());

create policy "player_badges_owner_read"
  on public.player_badges for select
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_badges_owner_insert"
  on public.player_badges for insert
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_badges_owner_update"
  on public.player_badges for update
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

insert into public.badge_definitions (
  title,
  description,
  badge_type,
  metric_key,
  target_value,
  icon_label,
  sort_order
)
values
  ('First Road', 'Walk your first mile across the Marches.', 'distance', null, 1609, '1 mi', 1),
  ('Trail Initiate', 'Complete your first training session.', 'training_sessions', null, 1, 'TRN', 2),
  ('Story Spark', 'Complete your first story marker.', 'story_completion', null, 1, 'STR', 3),
  ('Beast Breaker', 'Defeat five animal enemies.', 'enemy_type_kills', 'Animal', 5, 'BST', 4)
on conflict do nothing;
