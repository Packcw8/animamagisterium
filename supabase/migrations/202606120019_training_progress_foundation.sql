create table if not exists public.attribute_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  attribute_key text not null check (attribute_key in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')),
  current_level integer not null default 0,
  current_xp integer not null default 0,
  next_goal_value numeric not null default 1,
  last_completed_at timestamp,
  cooldown_until timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (character_id, attribute_key)
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  attribute_key text not null check (attribute_key in ('strength', 'endurance', 'agility', 'intelligence', 'wisdom', 'charisma', 'spirit')),
  activity_label text not null,
  goal_value numeric not null,
  goal_unit text not null,
  attribute_xp integer not null default 25,
  character_xp integer not null default 25,
  training_date date not null default current_date,
  completed_at timestamp default now()
);

alter table public.attribute_progress enable row level security;
alter table public.training_sessions enable row level security;

grant select, insert, update, delete on public.attribute_progress to authenticated;
grant select, insert, update, delete on public.training_sessions to authenticated;

drop policy if exists "attribute_progress_owner_read" on public.attribute_progress;
drop policy if exists "attribute_progress_owner_insert" on public.attribute_progress;
drop policy if exists "attribute_progress_owner_update" on public.attribute_progress;
drop policy if exists "attribute_progress_owner_delete" on public.attribute_progress;

create policy "attribute_progress_owner_read"
  on public.attribute_progress for select
  using (auth.uid() = user_id);

create policy "attribute_progress_owner_insert"
  on public.attribute_progress for insert
  with check (auth.uid() = user_id);

create policy "attribute_progress_owner_update"
  on public.attribute_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "attribute_progress_owner_delete"
  on public.attribute_progress for delete
  using (auth.uid() = user_id);

drop policy if exists "training_sessions_owner_read" on public.training_sessions;
drop policy if exists "training_sessions_owner_insert" on public.training_sessions;
drop policy if exists "training_sessions_owner_update" on public.training_sessions;
drop policy if exists "training_sessions_owner_delete" on public.training_sessions;

create policy "training_sessions_owner_read"
  on public.training_sessions for select
  using (auth.uid() = user_id);

create policy "training_sessions_owner_insert"
  on public.training_sessions for insert
  with check (auth.uid() = user_id);

create policy "training_sessions_owner_update"
  on public.training_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "training_sessions_owner_delete"
  on public.training_sessions for delete
  using (auth.uid() = user_id);
