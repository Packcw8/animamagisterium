alter table public.map_markers
  add column if not exists story_order integer not null default 0,
  add column if not exists unlock_after_marker_id uuid references public.map_markers(id) on delete set null,
  add column if not exists hide_when_completed boolean not null default true,
  add column if not exists require_all_linked_routes boolean not null default true;

create table if not exists public.story_marker_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  completed_at timestamp default now(),
  unique (user_id, marker_id)
);

alter table public.story_marker_completions enable row level security;

grant select, insert, update, delete on public.story_marker_completions to authenticated;

drop policy if exists "story_marker_completions_owner_read" on public.story_marker_completions;
drop policy if exists "story_marker_completions_owner_insert" on public.story_marker_completions;
drop policy if exists "story_marker_completions_owner_update" on public.story_marker_completions;
drop policy if exists "story_marker_completions_admin_delete" on public.story_marker_completions;

create policy "story_marker_completions_owner_read"
  on public.story_marker_completions for select
  to authenticated
  using (user_id = auth.uid() or public.is_map_admin());

create policy "story_marker_completions_owner_insert"
  on public.story_marker_completions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "story_marker_completions_owner_update"
  on public.story_marker_completions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "story_marker_completions_admin_delete"
  on public.story_marker_completions for delete
  to authenticated
  using (public.is_map_admin());
