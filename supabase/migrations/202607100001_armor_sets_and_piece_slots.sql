alter table public.item_definitions
  add column if not exists equip_penalty_target text,
  add column if not exists equip_penalty_amount integer not null default 0,
  add column if not exists armor_set_key text,
  add column if not exists armor_set_name text,
  add column if not exists armor_piece_slot text,
  add column if not exists set_bonus_target text,
  add column if not exists set_bonus_amount integer not null default 0,
  add column if not exists set_penalty_target text,
  add column if not exists set_penalty_amount integer not null default 0;

alter table public.item_definitions
  drop constraint if exists item_definitions_equipment_slot_check;

alter table public.item_definitions
  add constraint item_definitions_equipment_slot_check
  check (
    equipment_slot is null
    or equipment_slot in (
      'weapon',
      'helmet',
      'chest',
      'gloves',
      'legs',
      'boots',
      'armor',
      'necklace',
      'ring',
      'charm',
      'relic'
    )
  );

alter table public.item_definitions
  drop constraint if exists item_definitions_armor_piece_slot_check;

alter table public.item_definitions
  add constraint item_definitions_armor_piece_slot_check
  check (
    armor_piece_slot is null
    or armor_piece_slot in ('helmet', 'chest', 'gloves', 'legs', 'boots')
  );

alter table public.equipped_items
  drop constraint if exists equipped_items_slot_check;

alter table public.equipped_items
  add constraint equipped_items_slot_check
  check (
    slot in (
      'weapon',
      'helmet',
      'chest',
      'gloves',
      'legs',
      'boots',
      'armor',
      'necklace',
      'ring',
      'charm',
      'relic'
    )
  );

update public.item_definitions
set armor_piece_slot = equipment_slot
where armor_piece_slot is null
  and equipment_slot in ('helmet', 'chest', 'gloves', 'legs', 'boots');

create index if not exists item_definitions_armor_set_key_idx
  on public.item_definitions (armor_set_key)
  where armor_set_key is not null;

create index if not exists item_definitions_equipment_slot_idx
  on public.item_definitions (equipment_slot)
  where equipment_slot is not null;
