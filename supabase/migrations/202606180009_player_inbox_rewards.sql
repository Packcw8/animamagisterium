create table if not exists public.player_inbox_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  title text not null,
  body text,
  reward_xp integer not null default 0,
  reward_gold integer not null default 0,
  reward_item_id uuid references public.item_definitions(id) on delete set null,
  reward_item_quantity integer not null default 1,
  is_claimed boolean not null default false,
  seen_at timestamp with time zone,
  claimed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists player_inbox_rewards_user_idx
  on public.player_inbox_rewards(user_id, is_claimed, created_at desc);

alter table public.player_inbox_rewards enable row level security;
grant select, insert, update, delete on public.player_inbox_rewards to authenticated;

drop policy if exists "player_inbox_rewards_owner_read" on public.player_inbox_rewards;
drop policy if exists "player_inbox_rewards_admin_insert" on public.player_inbox_rewards;
drop policy if exists "player_inbox_rewards_owner_update" on public.player_inbox_rewards;
drop policy if exists "player_inbox_rewards_admin_delete" on public.player_inbox_rewards;

create policy "player_inbox_rewards_owner_read"
  on public.player_inbox_rewards for select
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_inbox_rewards_admin_insert"
  on public.player_inbox_rewards for insert
  to authenticated
  with check (public.is_map_admin());

create policy "player_inbox_rewards_owner_update"
  on public.player_inbox_rewards for update
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_inbox_rewards_admin_delete"
  on public.player_inbox_rewards for delete
  to authenticated
  using (public.is_map_admin());
