create table if not exists public.player_friends (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_friends_not_self check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create index if not exists player_friends_requester_idx on public.player_friends(requester_id, status);
create index if not exists player_friends_addressee_idx on public.player_friends(addressee_id, status);

alter table public.player_friends enable row level security;
grant select, insert, update, delete on public.player_friends to authenticated;

drop policy if exists "player_friends_participant_read" on public.player_friends;
drop policy if exists "player_friends_requester_insert" on public.player_friends;
drop policy if exists "player_friends_participant_update" on public.player_friends;
drop policy if exists "player_friends_participant_delete" on public.player_friends;

create policy "player_friends_participant_read"
  on public.player_friends for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_map_admin());

create policy "player_friends_requester_insert"
  on public.player_friends for insert
  to authenticated
  with check (auth.uid() = requester_id and requester_id <> addressee_id);

create policy "player_friends_participant_update"
  on public.player_friends for update
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_map_admin())
  with check (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_map_admin());

create policy "player_friends_participant_delete"
  on public.player_friends for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_map_admin());

drop policy if exists "player_badges_friend_read" on public.player_badges;
create policy "player_badges_friend_read"
  on public.player_badges for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_map_admin()
    or exists (
      select 1
      from public.player_friends pf
      where pf.status = 'accepted'
        and (
          (pf.requester_id = auth.uid() and pf.addressee_id = player_badges.user_id)
          or (pf.addressee_id = auth.uid() and pf.requester_id = player_badges.user_id)
        )
    )
  );
