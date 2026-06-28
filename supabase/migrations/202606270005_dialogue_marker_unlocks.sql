alter table public.story_dialogue_choices
  add column if not exists unlock_marker_id uuid references public.map_markers(id) on delete set null,
  add column if not exists update_notification_title text,
  add column if not exists update_notification_body text;

create table if not exists public.player_marker_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  source_choice_id uuid references public.story_dialogue_choices(id) on delete set null,
  unlocked_at timestamp default now(),
  unique (user_id, marker_id)
);

alter table public.player_marker_unlocks enable row level security;

grant select, insert, delete on public.player_marker_unlocks to authenticated;

drop policy if exists "player_marker_unlocks_read" on public.player_marker_unlocks;
drop policy if exists "player_marker_unlocks_insert" on public.player_marker_unlocks;
drop policy if exists "player_marker_unlocks_delete" on public.player_marker_unlocks;

create policy "player_marker_unlocks_read"
  on public.player_marker_unlocks for select
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_marker_unlocks_insert"
  on public.player_marker_unlocks for insert
  with check (auth.uid() = user_id);

create policy "player_marker_unlocks_delete"
  on public.player_marker_unlocks for delete
  using (auth.uid() = user_id or public.is_map_admin());

create index if not exists player_marker_unlocks_user_idx
  on public.player_marker_unlocks(user_id);

create index if not exists player_marker_unlocks_marker_idx
  on public.player_marker_unlocks(marker_id);

create index if not exists story_dialogue_choices_unlock_marker_idx
  on public.story_dialogue_choices(unlock_marker_id);

drop policy if exists "map_markers_read" on public.map_markers;

create policy "map_markers_read"
  on public.map_markers for select
  using (
    public.is_map_admin()
    or (
      is_active = true
      and (
        is_unlocked = true
        or exists (
          select 1
          from public.player_marker_unlocks
          where player_marker_unlocks.marker_id = map_markers.id
            and player_marker_unlocks.user_id = auth.uid()
        )
      )
    )
  );
