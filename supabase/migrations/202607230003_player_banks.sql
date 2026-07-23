create table if not exists public.player_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  gold_balance integer not null default 0 check (gold_balance >= 0),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (character_id)
);

create table if not exists public.player_bank_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id uuid not null references public.item_definitions(id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 0),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (character_id, item_id)
);

alter table public.player_bank_accounts enable row level security;
alter table public.player_bank_items enable row level security;

grant select, insert, update on public.player_bank_accounts to authenticated;
grant select, insert, update, delete on public.player_bank_items to authenticated;

drop policy if exists "player_bank_accounts_owner_read" on public.player_bank_accounts;
drop policy if exists "player_bank_accounts_owner_insert" on public.player_bank_accounts;
drop policy if exists "player_bank_accounts_owner_update" on public.player_bank_accounts;

create policy "player_bank_accounts_owner_read"
  on public.player_bank_accounts for select
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_bank_accounts_owner_insert"
  on public.player_bank_accounts for insert
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_bank_accounts_owner_update"
  on public.player_bank_accounts for update
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

drop policy if exists "player_bank_items_owner_read" on public.player_bank_items;
drop policy if exists "player_bank_items_owner_insert" on public.player_bank_items;
drop policy if exists "player_bank_items_owner_update" on public.player_bank_items;
drop policy if exists "player_bank_items_owner_delete" on public.player_bank_items;

create policy "player_bank_items_owner_read"
  on public.player_bank_items for select
  using (auth.uid() = user_id or public.is_map_admin());

create policy "player_bank_items_owner_insert"
  on public.player_bank_items for insert
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_bank_items_owner_update"
  on public.player_bank_items for update
  using (auth.uid() = user_id or public.is_map_admin())
  with check (auth.uid() = user_id or public.is_map_admin());

create policy "player_bank_items_owner_delete"
  on public.player_bank_items for delete
  using (auth.uid() = user_id or public.is_map_admin());

create or replace function public.ensure_player_bank_account(p_character_id uuid)
returns public.player_bank_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.player_bank_accounts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  perform 1
  from public.characters
  where id = p_character_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Character not found.';
  end if;

  insert into public.player_bank_accounts (user_id, character_id)
  values (v_user_id, p_character_id)
  on conflict (character_id)
  do update set updated_at = public.player_bank_accounts.updated_at
  returning * into v_account;

  return v_account;
end;
$$;

create or replace function public.deposit_character_gold_to_bank(
  p_character_id uuid,
  p_amount integer
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount integer := greatest(1, coalesce(p_amount, 0));
  v_character public.characters%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  perform public.ensure_player_bank_account(p_character_id);

  update public.characters
  set gold = gold - v_amount
  where id = p_character_id
    and user_id = v_user_id
    and gold >= v_amount
  returning * into v_character;

  if not found then
    raise exception 'Not enough gold to deposit.';
  end if;

  update public.player_bank_accounts
  set gold_balance = gold_balance + v_amount,
      updated_at = now()
  where character_id = p_character_id
    and user_id = v_user_id;

  return v_character;
end;
$$;

create or replace function public.withdraw_character_gold_from_bank(
  p_character_id uuid,
  p_amount integer
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount integer := greatest(1, coalesce(p_amount, 0));
  v_character public.characters%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  perform public.ensure_player_bank_account(p_character_id);

  update public.player_bank_accounts
  set gold_balance = gold_balance - v_amount,
      updated_at = now()
  where character_id = p_character_id
    and user_id = v_user_id
    and gold_balance >= v_amount;

  if not found then
    raise exception 'Not enough gold in bank.';
  end if;

  update public.characters
  set gold = gold + v_amount
  where id = p_character_id
    and user_id = v_user_id
  returning * into v_character;

  return v_character;
end;
$$;

create or replace function public.deposit_character_item_to_bank(
  p_character_id uuid,
  p_item_id uuid,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quantity integer := greatest(1, coalesce(p_quantity, 1));
  v_inventory public.player_inventory%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  perform public.ensure_player_bank_account(p_character_id);

  select * into v_inventory
  from public.player_inventory
  where character_id = p_character_id
    and item_id = p_item_id
    and user_id = v_user_id
  for update;

  if not found or coalesce(v_inventory.quantity, 0) < v_quantity then
    raise exception 'Not enough items to deposit.';
  end if;

  if exists (
    select 1
    from public.equipped_items
    where character_id = p_character_id
      and user_id = v_user_id
      and item_id = p_item_id
  ) then
    raise exception 'Unequip this item before depositing it.';
  end if;

  update public.player_inventory
  set quantity = quantity - v_quantity,
      updated_at = now()
  where id = v_inventory.id;

  delete from public.player_inventory
  where id = v_inventory.id
    and quantity <= 0;

  insert into public.player_bank_items (user_id, character_id, item_id, quantity, updated_at)
  values (v_user_id, p_character_id, p_item_id, v_quantity, now())
  on conflict (character_id, item_id)
  do update set
    quantity = public.player_bank_items.quantity + excluded.quantity,
    updated_at = now();

  return jsonb_build_object('item_id', p_item_id, 'quantity', v_quantity);
end;
$$;

create or replace function public.withdraw_character_item_from_bank(
  p_character_id uuid,
  p_item_id uuid,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quantity integer := greatest(1, coalesce(p_quantity, 1));
  v_bank_item public.player_bank_items%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  perform public.ensure_player_bank_account(p_character_id);

  select * into v_bank_item
  from public.player_bank_items
  where character_id = p_character_id
    and item_id = p_item_id
    and user_id = v_user_id
  for update;

  if not found or coalesce(v_bank_item.quantity, 0) < v_quantity then
    raise exception 'Not enough items in bank.';
  end if;

  update public.player_bank_items
  set quantity = quantity - v_quantity,
      updated_at = now()
  where id = v_bank_item.id;

  delete from public.player_bank_items
  where id = v_bank_item.id
    and quantity <= 0;

  perform public.grant_item_to_character_atomic(p_character_id, p_item_id, v_quantity);

  return jsonb_build_object('item_id', p_item_id, 'quantity', v_quantity);
end;
$$;

grant execute on function public.ensure_player_bank_account(uuid) to authenticated;
grant execute on function public.deposit_character_gold_to_bank(uuid, integer) to authenticated;
grant execute on function public.withdraw_character_gold_from_bank(uuid, integer) to authenticated;
grant execute on function public.deposit_character_item_to_bank(uuid, uuid, integer) to authenticated;
grant execute on function public.withdraw_character_item_from_bank(uuid, uuid, integer) to authenticated;
