alter table public.item_definitions
  drop constraint if exists item_definitions_type_check;

alter table public.item_definitions
  add constraint item_definitions_type_check
  check (type in (
    'weapon',
    'armor',
    'wearable',
    'potion',
    'revive potion',
    'consumable',
    'food',
    'scroll',
    'special',
    'material',
    'tool',
    'utility',
    'bait',
    'throwable',
    'misc'
  ));
