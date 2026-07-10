alter table public.item_definitions
  drop constraint if exists item_definitions_equipment_slot_check;

alter table public.item_definitions
  add constraint item_definitions_equipment_slot_check
  check (
    equipment_slot is null
    or equipment_slot in (
      'weapon',
      'main_hand',
      'off_hand',
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

alter table public.equipped_items
  drop constraint if exists equipped_items_slot_check;

alter table public.equipped_items
  add constraint equipped_items_slot_check
  check (
    slot in (
      'weapon',
      'main_hand',
      'off_hand',
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
