alter table public.map_markers
  add column if not exists player_market_slot_count integer not null default 3,
  add column if not exists player_market_rent_gold integer not null default 0,
  add column if not exists player_market_duration_days integer not null default 7;

update public.map_markers
set
  player_market_slot_count = greatest(1, coalesce(player_market_slot_count, 3)),
  player_market_rent_gold = greatest(0, coalesce(player_market_rent_gold, 0)),
  player_market_duration_days = greatest(1, coalesce(player_market_duration_days, 7));

alter table public.map_markers
  drop constraint if exists map_markers_player_market_slot_count_check,
  drop constraint if exists map_markers_player_market_rent_gold_check,
  drop constraint if exists map_markers_player_market_duration_days_check;

alter table public.map_markers
  add constraint map_markers_player_market_slot_count_check check (player_market_slot_count >= 1 and player_market_slot_count <= 20),
  add constraint map_markers_player_market_rent_gold_check check (player_market_rent_gold >= 0),
  add constraint map_markers_player_market_duration_days_check check (player_market_duration_days >= 1 and player_market_duration_days <= 30);

create table if not exists public.player_market_spots (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  slot_number integer not null check (slot_number >= 1),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_character_id uuid not null references public.characters(id) on delete cascade,
  stall_name text not null default 'Market Stall',
  rented_at timestamp with time zone default now(),
  rented_until timestamp with time zone not null,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (marker_id, slot_number)
);

create table if not exists public.player_market_listings (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.player_market_spots(id) on delete cascade,
  marker_id uuid not null references public.map_markers(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  seller_character_id uuid not null references public.characters(id) on delete cascade,
  item_id uuid not null references public.item_definitions(id) on delete cascade,
  quantity_available integer not null check (quantity_available >= 0),
  price_per_item integer not null check (price_per_item >= 0),
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists player_market_spots_marker_idx on public.player_market_spots(marker_id, is_active, rented_until);
create index if not exists player_market_spots_owner_idx on public.player_market_spots(owner_user_id, owner_character_id);
create index if not exists player_market_listings_marker_idx on public.player_market_listings(marker_id, is_active);
create index if not exists player_market_listings_spot_idx on public.player_market_listings(spot_id, is_active);
create index if not exists player_market_listings_seller_idx on public.player_market_listings(seller_user_id, seller_character_id);

alter table public.player_market_spots enable row level security;
alter table public.player_market_listings enable row level security;

grant select, insert, update, delete on public.player_market_spots to authenticated;
grant select, insert, update, delete on public.player_market_listings to authenticated;

drop policy if exists "player_market_spots_read" on public.player_market_spots;
drop policy if exists "player_market_spots_owner_write" on public.player_market_spots;
drop policy if exists "player_market_spots_owner_delete" on public.player_market_spots;

create policy "player_market_spots_read"
  on public.player_market_spots for select
  using (true);

create policy "player_market_spots_owner_write"
  on public.player_market_spots for all
  using (auth.uid() = owner_user_id or public.is_map_admin())
  with check (auth.uid() = owner_user_id or public.is_map_admin());

drop policy if exists "player_market_listings_read" on public.player_market_listings;
drop policy if exists "player_market_listings_owner_write" on public.player_market_listings;

create policy "player_market_listings_read"
  on public.player_market_listings for select
  using (true);

create policy "player_market_listings_owner_write"
  on public.player_market_listings for all
  using (auth.uid() = seller_user_id or public.is_map_admin())
  with check (auth.uid() = seller_user_id or public.is_map_admin());

create or replace function public.claim_player_market_spot(
  p_marker_id uuid,
  p_character_id uuid,
  p_stall_name text default null
)
returns public.player_market_spots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_marker public.map_markers%rowtype;
  v_character public.characters%rowtype;
  v_slot integer;
  v_spot public.player_market_spots%rowtype;
  v_stall_name text := left(coalesce(nullif(trim(p_stall_name), ''), 'Market Stall'), 80);
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_marker
  from public.map_markers
  where id = p_marker_id
    and type = 'Player Market'
    and is_active = true;

  if not found then
    raise exception 'Player market marker not found.';
  end if;

  select * into v_character
  from public.characters
  where id = p_character_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Character not found.';
  end if;

  update public.player_market_spots
  set is_active = false,
      updated_at = now()
  where marker_id = p_marker_id
    and is_active = true
    and rented_until <= now();

  select * into v_spot
  from public.player_market_spots
  where marker_id = p_marker_id
    and owner_character_id = p_character_id
    and is_active = true
    and rented_until > now()
  order by rented_until desc
  limit 1;

  if found then
    return v_spot;
  end if;

  if coalesce(v_marker.player_market_rent_gold, 0) > 0 then
    if coalesce(v_character.gold, 0) < v_marker.player_market_rent_gold then
      raise exception 'Requires % gold to rent this stall.', v_marker.player_market_rent_gold;
    end if;

    update public.characters
    set gold = gold - v_marker.player_market_rent_gold
    where id = p_character_id
      and user_id = v_user_id;
  end if;

  select slot_number into v_slot
  from generate_series(1, greatest(1, coalesce(v_marker.player_market_slot_count, 3))) as slot_number
  where not exists (
    select 1
    from public.player_market_spots s
    where s.marker_id = p_marker_id
      and s.slot_number = slot_number
      and s.is_active = true
      and s.rented_until > now()
  )
  order by slot_number
  limit 1;

  if v_slot is null then
    raise exception 'All market spots are currently rented.';
  end if;

  insert into public.player_market_spots (
    marker_id,
    slot_number,
    owner_user_id,
    owner_character_id,
    stall_name,
    rented_until
  )
  values (
    p_marker_id,
    v_slot,
    v_user_id,
    p_character_id,
    v_stall_name,
    now() + (greatest(1, coalesce(v_marker.player_market_duration_days, 7)) || ' days')::interval
  )
  returning * into v_spot;

  return v_spot;
end;
$$;

create or replace function public.create_player_market_listing(
  p_spot_id uuid,
  p_character_id uuid,
  p_item_id uuid,
  p_quantity integer,
  p_price_per_item integer
)
returns public.player_market_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quantity integer := greatest(1, coalesce(p_quantity, 1));
  v_price integer := greatest(0, coalesce(p_price_per_item, 0));
  v_spot public.player_market_spots%rowtype;
  v_inventory public.player_inventory%rowtype;
  v_listing public.player_market_listings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_spot
  from public.player_market_spots
  where id = p_spot_id
    and owner_user_id = v_user_id
    and owner_character_id = p_character_id
    and is_active = true
    and rented_until > now()
  for update;

  if not found then
    raise exception 'You do not own an active stall here.';
  end if;

  select * into v_inventory
  from public.player_inventory
  where character_id = p_character_id
    and user_id = v_user_id
    and item_id = p_item_id
  for update;

  if not found or coalesce(v_inventory.quantity, 0) < v_quantity then
    raise exception 'Not enough inventory to list.';
  end if;

  if exists (
    select 1
    from public.equipped_items
    where character_id = p_character_id
      and user_id = v_user_id
      and item_id = p_item_id
  ) then
    raise exception 'Unequip this item before listing it.';
  end if;

  update public.player_inventory
  set quantity = quantity - v_quantity,
      updated_at = now()
  where id = v_inventory.id;

  delete from public.player_inventory
  where id = v_inventory.id
    and quantity <= 0;

  insert into public.player_market_listings (
    spot_id,
    marker_id,
    seller_user_id,
    seller_character_id,
    item_id,
    quantity_available,
    price_per_item
  )
  values (
    p_spot_id,
    v_spot.marker_id,
    v_user_id,
    p_character_id,
    p_item_id,
    v_quantity,
    v_price
  )
  returning * into v_listing;

  return v_listing;
end;
$$;

create or replace function public.cancel_player_market_listing(
  p_listing_id uuid,
  p_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.player_market_listings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_listing
  from public.player_market_listings
  where id = p_listing_id
    and seller_user_id = v_user_id
    and seller_character_id = p_character_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;

  update public.player_market_listings
  set is_active = false,
      quantity_available = 0,
      updated_at = now()
  where id = p_listing_id;

  if coalesce(v_listing.quantity_available, 0) > 0 then
    perform public.grant_item_to_character_atomic(p_character_id, v_listing.item_id, v_listing.quantity_available);
  end if;

  return jsonb_build_object('item_id', v_listing.item_id, 'quantity', v_listing.quantity_available);
end;
$$;

create or replace function public.buy_player_market_listing(
  p_listing_id uuid,
  p_buyer_character_id uuid,
  p_quantity integer default 1
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quantity integer := greatest(1, coalesce(p_quantity, 1));
  v_listing public.player_market_listings%rowtype;
  v_spot public.player_market_spots%rowtype;
  v_buyer public.characters%rowtype;
  v_total integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_buyer
  from public.characters
  where id = p_buyer_character_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Buyer character not found.';
  end if;

  select * into v_listing
  from public.player_market_listings
  where id = p_listing_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;

  select * into v_spot
  from public.player_market_spots
  where id = v_listing.spot_id
    and is_active = true
    and rented_until > now();

  if not found then
    raise exception 'This stall is no longer active.';
  end if;

  if v_listing.seller_character_id = p_buyer_character_id then
    raise exception 'You cannot buy your own listing.';
  end if;

  if coalesce(v_listing.quantity_available, 0) < v_quantity then
    raise exception 'Not enough stock remaining.';
  end if;

  v_total := greatest(0, coalesce(v_listing.price_per_item, 0)) * v_quantity;

  if coalesce(v_buyer.gold, 0) < v_total then
    raise exception 'Not enough gold.';
  end if;

  update public.characters
  set gold = gold - v_total
  where id = p_buyer_character_id
    and user_id = v_user_id
  returning * into v_buyer;

  update public.characters
  set gold = greatest(0, coalesce(gold, 0) + v_total)
  where id = v_listing.seller_character_id
    and user_id = v_listing.seller_user_id;

  update public.player_market_listings
  set quantity_available = quantity_available - v_quantity,
      is_active = quantity_available - v_quantity > 0,
      updated_at = now()
  where id = v_listing.id;

  perform public.grant_item_to_character_atomic(p_buyer_character_id, v_listing.item_id, v_quantity);

  return v_buyer;
end;
$$;

grant execute on function public.claim_player_market_spot(uuid, uuid, text) to authenticated;
grant execute on function public.create_player_market_listing(uuid, uuid, uuid, integer, integer) to authenticated;
grant execute on function public.cancel_player_market_listing(uuid, uuid) to authenticated;
grant execute on function public.buy_player_market_listing(uuid, uuid, integer) to authenticated;
