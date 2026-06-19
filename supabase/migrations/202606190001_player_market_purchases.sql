create table if not exists public.player_market_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  market_item_id uuid not null references public.marker_market_items(id) on delete cascade,
  quantity_purchased integer not null default 0,
  updated_at timestamp with time zone not null default now(),
  unique (user_id, market_item_id)
);

create index if not exists player_market_purchases_user_idx
  on public.player_market_purchases(user_id, market_item_id);

alter table public.player_market_purchases enable row level security;
grant select, insert, update, delete on public.player_market_purchases to authenticated;

drop policy if exists "player_market_purchases_owner_read" on public.player_market_purchases;
drop policy if exists "player_market_purchases_owner_insert" on public.player_market_purchases;
drop policy if exists "player_market_purchases_owner_update" on public.player_market_purchases;
drop policy if exists "player_market_purchases_owner_delete" on public.player_market_purchases;

create policy "player_market_purchases_owner_read"
  on public.player_market_purchases for select
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_market_purchases_owner_insert"
  on public.player_market_purchases for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "player_market_purchases_owner_update"
  on public.player_market_purchases for update
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_market_purchases_owner_delete"
  on public.player_market_purchases for delete
  to authenticated
  using (auth.uid() = user_id or public.is_map_admin());
