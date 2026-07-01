-- Tracks server-side avatar generation attempts so image generation can be limited per player.
create table if not exists public.user_avatar_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'succeeded', 'failed')),
  mode text not null default 'photo' check (mode in ('photo', 'custom')),
  portrait_url text,
  error_message text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists user_avatar_generations_one_active_per_user
  on public.user_avatar_generations(user_id)
  where status in ('started', 'succeeded');

alter table public.user_avatar_generations enable row level security;

grant select, insert, update on public.user_avatar_generations to authenticated;

drop policy if exists "user_avatar_generations_owner_read" on public.user_avatar_generations;
drop policy if exists "user_avatar_generations_owner_insert" on public.user_avatar_generations;
drop policy if exists "user_avatar_generations_owner_update" on public.user_avatar_generations;

create policy "user_avatar_generations_owner_read"
  on public.user_avatar_generations for select
  using (auth.uid() = user_id);

create policy "user_avatar_generations_owner_insert"
  on public.user_avatar_generations for insert
  with check (auth.uid() = user_id);

create policy "user_avatar_generations_owner_update"
  on public.user_avatar_generations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
