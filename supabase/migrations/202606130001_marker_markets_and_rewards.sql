alter table public.map_markers
  add column if not exists quest_title text,
  add column if not exists quest_dialogue text,
  add column if not exists quest_image_url text,
  add column if not exists reward_xp integer not null default 0,
  add column if not exists reward_gold integer not null default 0,
  add column if not exists reward_item_id uuid references public.item_definitions(id) on delete set null,
  add column if not exists reward_item_quantity integer not null default 1,
  add column if not exists repeatable boolean not null default false,
  add column if not exists reward_once_per_player boolean not null default true;

alter table public.map_events
  add column if not exists reward_gold integer not null default 0,
  add column if not exists reward_item_id uuid references public.item_definitions(id) on delete set null,
  add column if not exists reward_item_quantity integer not null default 1;

alter table public.story_dialogue_choices
  add column if not exists reward_gold integer not null default 0,
  add column if not exists reward_item_id uuid references public.item_definitions(id) on delete set null,
  add column if not exists reward_item_quantity integer not null default 1;

create table if not exists public.marker_market_items (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  item_id uuid not null references public.item_definitions(id) on delete cascade,
  buy_price integer not null default 0,
  sell_price integer not null default 0,
  stock_quantity integer,
  unlimited_stock boolean not null default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (marker_id, item_id)
);

create table if not exists public.marker_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  marker_id uuid references public.map_markers(id) on delete cascade,
  event_id uuid references public.map_events(id) on delete cascade,
  choice_id uuid references public.story_dialogue_choices(id) on delete cascade,
  claimed_at timestamp default now()
);

create unique index if not exists marker_reward_claims_marker_unique
  on public.marker_reward_claims(user_id, marker_id)
  where marker_id is not null;

create unique index if not exists marker_reward_claims_event_unique
  on public.marker_reward_claims(user_id, event_id)
  where event_id is not null;

create unique index if not exists marker_reward_claims_choice_unique
  on public.marker_reward_claims(user_id, choice_id)
  where choice_id is not null;

alter table public.marker_market_items enable row level security;
alter table public.marker_reward_claims enable row level security;

grant select, insert, update, delete on public.marker_market_items to authenticated;
grant select, insert, update, delete on public.marker_reward_claims to authenticated;

drop policy if exists "marker_market_items_read" on public.marker_market_items;
drop policy if exists "marker_market_items_admin_insert" on public.marker_market_items;
drop policy if exists "marker_market_items_admin_update" on public.marker_market_items;
drop policy if exists "marker_market_items_admin_delete" on public.marker_market_items;

create policy "marker_market_items_read"
  on public.marker_market_items for select
  to authenticated
  using (
    public.is_map_admin()
    or exists (
      select 1 from public.map_markers
      where map_markers.id = marker_market_items.marker_id
        and map_markers.is_active = true
        and map_markers.is_unlocked = true
    )
  );

create policy "marker_market_items_admin_insert"
  on public.marker_market_items for insert
  to authenticated
  with check (public.is_map_admin());

create policy "marker_market_items_admin_update"
  on public.marker_market_items for update
  to authenticated
  using (public.is_map_admin())
  with check (public.is_map_admin());

create policy "marker_market_items_admin_delete"
  on public.marker_market_items for delete
  to authenticated
  using (public.is_map_admin());

drop policy if exists "marker_reward_claims_owner_read" on public.marker_reward_claims;
drop policy if exists "marker_reward_claims_owner_insert" on public.marker_reward_claims;
drop policy if exists "marker_reward_claims_admin_delete" on public.marker_reward_claims;

create policy "marker_reward_claims_owner_read"
  on public.marker_reward_claims for select
  to authenticated
  using (user_id = auth.uid() or public.is_map_admin());

create policy "marker_reward_claims_owner_insert"
  on public.marker_reward_claims for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "marker_reward_claims_admin_delete"
  on public.marker_reward_claims for delete
  to authenticated
  using (public.is_map_admin());
