create table if not exists public.story_marker_starts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  started_at timestamp default now(),
  unique (user_id, marker_id)
);

alter table public.story_marker_starts enable row level security;

grant select, insert, update, delete on public.story_marker_starts to authenticated;

drop policy if exists "story_marker_starts_owner_read" on public.story_marker_starts;
drop policy if exists "story_marker_starts_owner_insert" on public.story_marker_starts;
drop policy if exists "story_marker_starts_owner_update" on public.story_marker_starts;
drop policy if exists "story_marker_starts_admin_delete" on public.story_marker_starts;

create policy "story_marker_starts_owner_read"
  on public.story_marker_starts for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "story_marker_starts_owner_insert"
  on public.story_marker_starts for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "story_marker_starts_owner_update"
  on public.story_marker_starts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "story_marker_starts_admin_delete"
  on public.story_marker_starts for delete
  to authenticated
  using (public.is_admin());
